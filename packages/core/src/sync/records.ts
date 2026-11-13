import type { ExamMode } from '../exam/exam';

/** 레벨별 기록 (계획 §13). 웹은 localStorage에 둔다 */
export interface LevelRecord {
  /** 처음 끝낸 시각 (ISO 8601) */
  readonly clearedAt: string;
  /** 끝낸 횟수. 끝난 세션 수와 옛 횟수로 다시 센다 (동기화 설계 §4.3) */
  readonly plays: number;
  /** 가장 높은 첫 시도 정확도 (0–1) */
  readonly bestAccuracy: number;
  /** 가장 빠른 가나/분. 잴 수 없었으면 null */
  readonly bestKpm: number | null;
}

export type Progress = Readonly<Record<string, LevelRecord>>;

/** 최고 기록으로 남긴 종합 테스트 한 판 */
export interface ExamBest {
  readonly kpm: number;
  /** 그 판의 WPM (헤본식 로마자 5글자 = 1단어). 이 값을 남기기 전의 기록에는 없다 */
  readonly wpm?: number;
  /** 그 판의 첫 시도 정확도 (0–1) */
  readonly accuracy: number;
  /** 그 판의 시간 (분) */
  readonly minutes: number;
  /** ISO 8601 */
  readonly at: string;
}

export interface ExamRecord {
  /** 시간을 끝까지 채운 횟수 */
  readonly plays: number;
  /** 가나/분이 가장 빨랐던 판 */
  readonly best: ExamBest | null;
  /**
   * 로마자 속도(CPM·WPM)가 가장 빨랐던 판. 가나 한 글자의 로마자 길이가 줄마다 달라 best와 다른 판일 수 있다.
   * 로마자 속도를 남기기 전의 기록에는 없다
   */
  readonly romajiBest?: ExamBest & { readonly wpm: number };
}

export type ExamRecords = Readonly<Partial<Record<ExamMode, ExamRecord>>>;

const higher = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.max(a, b);

/**
 * 두 레벨 기록을 합친다. 처음 끝낸 때는 이른 쪽, 횟수·최고 기록은 큰 쪽.
 * 순서·중복과 무관하다. 횟수는 합친 뒤 끝난 세션 수와 옛 횟수로 다시 센다 (동기화 설계 §4.3)
 */
export function mergeLevelRecord(a: LevelRecord, b: LevelRecord): LevelRecord {
  return {
    clearedAt: a.clearedAt <= b.clearedAt ? a.clearedAt : b.clearedAt,
    plays: Math.max(a.plays, b.plays),
    bestAccuracy: Math.max(a.bestAccuracy, b.bestAccuracy),
    bestKpm: higher(a.bestKpm, b.bestKpm),
  };
}

/** 둘 중 speed가 빠른 쪽 (같으면 a) */
const fasterOf = <T extends ExamBest>(
  a: T | null | undefined,
  b: T | null | undefined,
  speed: (best: T) => number,
) => (a == null ? b : b == null || speed(a) >= speed(b) ? a : b);

/** 두 종합 테스트 기록을 합친다. 횟수는 큰 쪽, 최고 기록은 가나/분·로마자 속도마다 빠른 쪽 */
export function mergeExamRecord(a: ExamRecord, b: ExamRecord): ExamRecord {
  const romajiBest = fasterOf(a.romajiBest, b.romajiBest, (best) => best.wpm);
  return {
    plays: Math.max(a.plays, b.plays),
    best: fasterOf(a.best, b.best, (best) => best.kpm) ?? null,
    ...(romajiBest ? { romajiBest } : {}),
  };
}
