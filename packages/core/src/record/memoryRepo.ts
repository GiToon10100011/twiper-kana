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
  };
}
