import Dexie, { type EntityTable } from 'dexie';
import {
  replacesSession,
  type AttemptRecord,
  type SessionRecord,
  type TrainingRepo,
} from '@twiper/core';

class TwiperDB extends Dexie {
  attempts!: EntityTable<AttemptRecord, 'id'>;
  sessions!: EntityTable<SessionRecord, 'id'>;

  constructor(name: string) {
    super(name);
    // 스키마를 바꿀 때는 이 버전을 지우지 말고 version(2)를 덧붙인다.
    this.version(1).stores({
      attempts: 'id, sessionId, levelId, at',
      sessions: 'id, [levelId+startedAt]',
    });
  }
}

/** IndexedDB(Dexie)로 구현한 훈련 기록 저장소 */
export function createDexieRepo(name = 'twiper'): TrainingRepo {
  const db = new TwiperDB(name);
  return {
    async saveAttempt(attempt) {
      await db.attempts.put(attempt);
    },
    async saveSession(session) {
      await db.sessions.put(session);
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
    mergeRecords(dump) {
      return db.transaction('rw', db.attempts, db.sessions, async () => {
        // 파일 안에서 같은 id가 겹쳐도 한 번만 넣는다
        const attemptsIn = [...new Map(dump.attempts.map((a) => [a.id, a])).values()];
        const known = await db.attempts.bulkGet(attemptsIn.map((a) => a.id));
        const fresh = attemptsIn.filter((_, i) => known[i] === undefined);
        await db.attempts.bulkAdd(fresh);
        const sessionsIn = [...new Map(dump.sessions.map((s) => [s.id, s])).values()];
        const current = await db.sessions.bulkGet(sessionsIn.map((s) => s.id));
        const replaced = sessionsIn.filter((s, i) => replacesSession(current[i], s));
        await db.sessions.bulkPut(replaced);
        return { attempts: fresh.length, sessions: replaced.length, persisted: true };
      });
    },
  };
}
