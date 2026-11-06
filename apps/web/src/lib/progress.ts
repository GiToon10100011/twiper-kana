import type { DrillSummary } from '@twiper/core';

const PROGRESS_KEY = 'twiper.progress.v1';

/**
 * 레벨별 기록. 작은 데이터라 우선 localStorage에 둔다.
 * 시도 기록(attempt 로그)을 IndexedDB에 저장하게 되면 그 로그에서 다시 계산한다 (계획 §13).
 */
export interface LevelRecord {
  /** 처음 끝낸 시각 (ISO 8601) */
  readonly clearedAt: string;
  readonly plays: number;
  /** 가장 높은 첫 시도 정확도 (0–1) */
  readonly bestAccuracy: number;
  /** 가장 빠른 가나/분. 잴 수 없었으면 null */
  readonly bestKpm: number | null;
}

export type Progress = Readonly<Record<string, LevelRecord>>;

const isLevelRecord = (value: unknown): value is LevelRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.clearedAt === 'string' &&
    typeof record.plays === 'number' &&
    typeof record.bestAccuracy === 'number' &&
    (record.bestKpm === null || typeof record.bestKpm === 'number')
  );
};

// 브라우저 저장소를 쓸 수 없어도(사생활 보호 모드 등) 훈련은 할 수 있어야 하므로 실패는 삼킨다.

/** 저장해 둔 값이나 가져온 백업 파일에서 레벨 기록만 골라낸다 */
export function parseProgress(value: unknown): Progress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, record]) => isLevelRecord(record)));
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? parseProgress(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** 저장했으면 true. 저장 공간이 차는 등으로 쓰지 못하면 false */
function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    // 저장하지 못해도 결과 화면은 보여 준다.
    return false;
  }
}

const higher = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.max(a, b);

/** 레벨을 끝까지 풀었을 때 기록한다. 끝낸 레벨의 다음 레벨이 열린다 */
export function recordLevel(
  id: string,
  summary: Pick<DrillSummary, 'accuracy' | 'kpm'>,
  now = new Date(),
): Progress {
  const progress = loadProgress();
  const prev = progress[id];
  const updated: Progress = {
    ...progress,
    [id]: {
      clearedAt: prev?.clearedAt ?? now.toISOString(),
      plays: (prev?.plays ?? 0) + 1,
      bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, summary.accuracy),
      bestKpm: higher(prev?.bestKpm ?? null, summary.kpm),
    },
  };
  saveProgress(updated);
  return updated;
}

/**
 * 백업 파일의 레벨 기록을 합친다. 처음 끝낸 시각은 이른 쪽, 횟수와 최고 기록은 큰 쪽을 남긴다.
 * 그래서 같은 파일을 두 번 합쳐도 그대로다 (두 기기에서 따로 푼 횟수는 더하지 않는다).
 * 바뀐 레벨 수와, 바뀐 기록을 저장했는지(바뀐 게 없으면 true)를 돌려준다
 */
export function mergeProgress(incoming: Progress): { changed: number; persisted: boolean } {
  const progress = loadProgress();
  const merged: Record<string, LevelRecord> = { ...progress };
  let changed = 0;
  for (const [id, record] of Object.entries(incoming)) {
    const prev = progress[id];
    const next: LevelRecord = prev
      ? {
          clearedAt: prev.clearedAt <= record.clearedAt ? prev.clearedAt : record.clearedAt,
          plays: Math.max(prev.plays, record.plays),
          bestAccuracy: Math.max(prev.bestAccuracy, record.bestAccuracy),
          bestKpm: higher(prev.bestKpm, record.bestKpm),
        }
      : record;
    const same =
      prev &&
      prev.clearedAt === next.clearedAt &&
      prev.plays === next.plays &&
      prev.bestAccuracy === next.bestAccuracy &&
      prev.bestKpm === next.bestKpm;
    if (same) continue;
    merged[id] = next;
    changed += 1;
  }
  return { changed, persisted: changed === 0 || saveProgress(merged) };
}

export const clearedLevels = (progress: Progress): Set<string> => new Set(Object.keys(progress));
