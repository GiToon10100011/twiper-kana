import { createMemoryRepo, ulid, type TrainingRepo } from '@twiper/core';

/**
 * 저장소가 실패해도 훈련은 계속되어야 하므로, 처음 실패하면 이번 실행 동안은 메모리 저장소로 바꾼다.
 * (사생활 보호 모드 등에서 IndexedDB를 열 수 없는 경우)
 */
export function resilientRepo(primary: TrainingRepo, fallback = createMemoryRepo()): TrainingRepo {
  let active = primary;
  const run = async <T>(call: (repo: TrainingRepo) => Promise<T>): Promise<T> => {
    try {
      return await call(active);
    } catch {
      active = fallback;
      return call(active);
    }
  };
  return {
    saveAttempt: (attempt) => run((repo) => repo.saveAttempt(attempt)),
    saveSession: (session) => run((repo) => repo.saveSession(session)),
    finishedSessions: (levelId, limit) => run((repo) => repo.finishedSessions(levelId, limit)),
    attemptsOf: (sessionId) => run((repo) => repo.attemptsOf(sessionId)),
    recentAttempts: (limit) => run((repo) => repo.recentAttempts(limit)),
    attemptTimes: () => run((repo) => repo.attemptTimes()),
    attemptsSince: (at) => run((repo) => repo.attemptsSince(at)),
  };
}

/** Dexie는 기록을 처음 저장·조회할 때 불러온다. 첫 화면(오프닝·홈) 번들에는 넣지 않는다 */
function lazyDexieRepo(): TrainingRepo {
  let loading: Promise<TrainingRepo> | null = null;
  const repo = () => (loading ??= import('./dexieRepo').then((m) => m.createDexieRepo()));
  return {
    saveAttempt: async (attempt) => (await repo()).saveAttempt(attempt),
    saveSession: async (session) => (await repo()).saveSession(session),
    finishedSessions: async (levelId, limit) => (await repo()).finishedSessions(levelId, limit),
    attemptsOf: async (sessionId) => (await repo()).attemptsOf(sessionId),
    recentAttempts: async (limit) => (await repo()).recentAttempts(limit),
    attemptTimes: async () => (await repo()).attemptTimes(),
    attemptsSince: async (at) => (await repo()).attemptsSince(at),
  };
}

let shared: TrainingRepo | null = null;

export function trainingRepo(): TrainingRepo {
  shared ??= resilientRepo(typeof indexedDB === 'undefined' ? createMemoryRepo() : lazyDexieRepo());
  return shared;
}

export const newId = (): string => ulid(Date.now(), crypto.getRandomValues(new Uint8Array(10)));
