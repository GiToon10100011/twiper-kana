import { replacesSession } from './dump';
import type { AttemptRecord, SessionRecord, TrainingRepo } from './types';

/** 메모리 저장소. 테스트용이자, 웹에서 IndexedDB를 쓸 수 없을 때(사생활 보호 모드 등)의 대안 */
export function createMemoryRepo(): TrainingRepo {
  const attempts: AttemptRecord[] = [];
  const sessions = new Map<string, SessionRecord>();
  return {
    saveAttempt(attempt) {
      attempts.push(attempt);
      return Promise.resolve();
    },
    saveSession(session) {
      sessions.set(session.id, session);
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
    mergeRecords(dump) {
      const known = new Set(attempts.map((a) => a.id));
      let added = 0;
      for (const attempt of dump.attempts) {
        if (known.has(attempt.id)) continue;
        known.add(attempt.id);
        attempts.push(attempt);
        added += 1;
      }
      let replaced = 0;
      for (const session of dump.sessions) {
        if (!replacesSession(sessions.get(session.id), session)) continue;
        sessions.set(session.id, session);
        replaced += 1;
      }
      return Promise.resolve({ attempts: added, sessions: replaced });
    },
  };
}
