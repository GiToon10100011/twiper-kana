import Dexie, { type EntityTable } from 'dexie';
import {
  countFinishedSessions,
  replacesSession,
  type AttemptRecord,
  type OutboxEntry,
  type SessionRecord,
  type TrainingRepo,
} from '@twiper/core';

class TwiperDB extends Dexie {
  attempts!: EntityTable<AttemptRecord, 'id'>;
  sessions!: EntityTable<SessionRecord, 'id'>;
  /** 아직 동기화 공간에 올리지 않은 기록 (동기화 설계 §4.2) */
  outbox!: EntityTable<OutboxEntry, 'key'>;

  constructor(name: string) {
    super(name);
    // 스키마를 바꿀 때는 앞 버전을 지우지 말고 다음 버전을 덧붙인다.
    this.version(1).stores({
      attempts: 'id, sessionId, levelId, at',
      sessions: 'id, [levelId+startedAt]',
    });
    this.version(2).stores({ outbox: 'key' });
  }
}

/** outbox 항목의 rev. 같은 기록이 다시 바뀌면 새 값이 되어, 그사이 올린 옛 내용으로 지우지 않는다 */
let revs = 0;
const nextRev = () => `${Date.now().toString(36)}-${(revs += 1).toString(36)}`;
const outboxOf = (prefix: 'a' | 's', ids: readonly string[]): OutboxEntry[] =>
  ids.map((id) => ({ key: `${prefix}:${id}`, rev: nextRev() }));

/** IndexedDB(Dexie)로 구현한 훈련 기록 저장소 */
export function createDexieRepo(name = 'twiper'): TrainingRepo {
  const db = new TwiperDB(name);
  return {
    async saveAttempt(attempt) {
      await db.transaction('rw', db.attempts, db.outbox, async () => {
        await db.attempts.put(attempt);
        await db.outbox.bulkPut(outboxOf('a', [attempt.id]));
      });
    },
    async saveSession(session) {
      await db.transaction('rw', db.sessions, db.outbox, async () => {
        await db.sessions.put(session);
        await db.outbox.bulkPut(outboxOf('s', [session.id]));
      });
    },
    finishedSessions(levelId, limit) {
      return db.sessions
        .where('[levelId+startedAt]')
        .between([levelId, Dexie.minKey], [levelId, Dexie.maxKey])
        .reverse()
        .filter((session) => session.endedAt !== null)
        .limit(limit)
        .toArray();
    },
    async finishedSessionCounts() {
      return countFinishedSessions(await db.sessions.toArray());
    },
    attemptsOf(sessionId) {
      return db.attempts.where('sessionId').equals(sessionId).sortBy('id');
    },
    recentAttempts(limit) {
      return db.attempts.orderBy('at').reverse().limit(limit).toArray();
    },
    async attemptTimes() {
      // 색인 값만 읽어 기록 본문은 불러오지 않는다
      return (await db.attempts.orderBy('at').keys()).map(String);
    },
    attemptsSince(at) {
      return db.attempts.where('at').aboveOrEqual(at).sortBy('at');
    },
    async dumpRecords() {
      const [attempts, sessions] = await Promise.all([
        db.attempts.orderBy('at').toArray(),
        db.sessions.toArray(),
      ]);
      return { attempts, sessions };
    },
    mergeRecords(dump, options) {
      const track = options?.track ?? true;
      return db.transaction('rw', db.attempts, db.sessions, db.outbox, async () => {
        // 파일 안에서 같은 id가 겹쳐도 한 번만 넣는다
        const attemptsIn = [...new Map(dump.attempts.map((a) => [a.id, a])).values()];
        const known = await db.attempts.bulkGet(attemptsIn.map((a) => a.id));
        const fresh = attemptsIn.filter((_, i) => known[i] === undefined);
        await db.attempts.bulkAdd(fresh);
        const sessionsIn = [...new Map(dump.sessions.map((s) => [s.id, s])).values()];
        const current = await db.sessions.bulkGet(sessionsIn.map((s) => s.id));
        const replaced = sessionsIn.filter((s, i) => replacesSession(current[i], s));
        await db.sessions.bulkPut(replaced);
        if (track) {
          await db.outbox.bulkPut([
            ...outboxOf(
              'a',
              fresh.map((a) => a.id),
            ),
            ...outboxOf(
              's',
              replaced.map((s) => s.id),
            ),
          ]);
        }
        return { attempts: fresh.length, sessions: replaced.length, persisted: true };
      });
    },
    pendingRecords() {
      return db.transaction('r', db.attempts, db.sessions, db.outbox, async () => {
        const entries = await db.outbox.toArray();
        const ids = (prefix: string) =>
          entries.filter((e) => e.key.startsWith(prefix)).map((e) => e.key.slice(2));
        const [attempts, sessions] = await Promise.all([
          db.attempts.bulkGet(ids('a:')),
          db.sessions.bulkGet(ids('s:')),
        ]);
        return {
          attempts: attempts.filter((a) => a !== undefined),
          sessions: sessions.filter((s) => s !== undefined),
          entries,
        };
      });
    },
    markPushed(entries) {
      return db.transaction('rw', db.outbox, async () => {
        const current = await db.outbox.bulkGet(entries.map((e) => e.key));
        const pushed = entries.filter((e, i) => current[i]?.rev === e.rev).map((e) => e.key);
        await db.outbox.bulkDelete(pushed);
      });
    },
  };
}
