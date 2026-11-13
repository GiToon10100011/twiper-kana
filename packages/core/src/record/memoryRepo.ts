import { countFinishedSessions } from '../sync/plays';
import { replacesSession } from './dump';
import type { AttemptRecord, OutboxEntry, SessionRecord, TrainingRepo } from './types';

/** 메모리 저장소. 테스트용이자, 웹에서 IndexedDB를 쓸 수 없을 때(사생활 보호 모드 등)의 대안 */
export function createMemoryRepo(): TrainingRepo {
  const attempts: AttemptRecord[] = [];
  const sessions = new Map<string, SessionRecord>();
  /** outbox: 항목 키 → rev */
  const outbox = new Map<string, string>();
  let revs = 0;
  const track = (key: string) => outbox.set(key, String((revs += 1)));
  return {
    saveAttempt(attempt) {
      attempts.push(attempt);
      track(`a:${attempt.id}`);
      return Promise.resolve();
    },
    saveSession(session) {
      sessions.set(session.id, session);
      track(`s:${session.id}`);
      return Promise.resolve();
    },
    finishedSessions(levelId, limit) {
      return Promise.resolve(
        [...sessions.values()]
          .filter((s) => s.levelId === levelId && s.endedAt !== null)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, limit),
      );
    },
    finishedSessionCounts() {
      return Promise.resolve(countFinishedSessions([...sessions.values()]));
    },
    attemptsOf(sessionId) {
      return Promise.resolve(attempts.filter((a) => a.sessionId === sessionId));
    },
    recentAttempts(limit) {
      return Promise.resolve(
        [...attempts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit),
      );
    },
    attemptTimes() {
      return Promise.resolve(attempts.map((a) => a.at).sort());
    },
    attemptsSince(at) {
      return Promise.resolve(
        attempts.filter((a) => a.at >= at).sort((a, b) => a.at.localeCompare(b.at)),
      );
    },
    dumpRecords() {
      return Promise.resolve({
        attempts: [...attempts].sort((a, b) => a.at.localeCompare(b.at)),
        sessions: [...sessions.values()],
      });
    },
    mergeRecords(dump, options) {
      const tracking = options?.track ?? true;
      const known = new Set(attempts.map((a) => a.id));
      let added = 0;
      for (const attempt of dump.attempts) {
        if (known.has(attempt.id)) continue;
        known.add(attempt.id);
        attempts.push(attempt);
        if (tracking) track(`a:${attempt.id}`);
        added += 1;
      }
      let replaced = 0;
      for (const session of dump.sessions) {
        if (!replacesSession(sessions.get(session.id), session)) continue;
        sessions.set(session.id, session);
        if (tracking) track(`s:${session.id}`);
        replaced += 1;
      }
      // 메모리에만 있으므로 다시 열면 사라진다
      return Promise.resolve({ attempts: added, sessions: replaced, persisted: false });
    },
    pendingRecords() {
      const entries: OutboxEntry[] = [...outbox].map(([key, rev]) => ({ key, rev }));
      const ids = (prefix: string) =>
        new Set(entries.filter((e) => e.key.startsWith(prefix)).map((e) => e.key.slice(2)));
      const attemptIds = ids('a:');
      const sessionIds = ids('s:');
      return Promise.resolve({
        attempts: attempts.filter((a) => attemptIds.has(a.id)),
        sessions: [...sessions.values()].filter((s) => sessionIds.has(s.id)),
        entries,
      });
    },
    markPushed(entries) {
      for (const { key, rev } of entries) if (outbox.get(key) === rev) outbox.delete(key);
      return Promise.resolve();
    },
  };
}
