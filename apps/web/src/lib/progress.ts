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

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isLevelRecord(value)));
  } catch {
    return {};
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
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
  } catch {
    // 저장하지 못해도 결과 화면은 보여 준다.
  }
  return updated;
}

export const clearedLevels = (progress: Progress): Set<string> => new Set(Object.keys(progress));
