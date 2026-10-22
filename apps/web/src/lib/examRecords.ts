import type { ExamMode, ExamSummary } from '@twiper/core';

const EXAM_KEY = 'twiper.exams.v1';

/** 종목별 최고 기록. 속도(가나/분)가 가장 빨랐던 판 */
export interface ExamBest {
  readonly kpm: number;
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
  readonly best: ExamBest | null;
}

export type ExamRecords = Readonly<Partial<Record<ExamMode, ExamRecord>>>;

const isBest = (value: unknown): value is ExamBest => {
  if (typeof value !== 'object' || value === null) return false;
  const best = value as Record<string, unknown>;
  return (
    typeof best.kpm === 'number' &&
    typeof best.accuracy === 'number' &&
    typeof best.minutes === 'number' &&
    typeof best.at === 'string'
  );
};

const isRecord = (value: unknown): value is ExamRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.plays === 'number' && (record.best === null || isBest(record.best));
};

// 브라우저 저장소를 쓸 수 없어도(사생활 보호 모드 등) 테스트는 할 수 있어야 하므로 실패는 삼킨다.

export function loadExamRecords(): ExamRecords {
  try {
    const raw = localStorage.getItem(EXAM_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isRecord(value)));
  } catch {
    return {};
  }
}

/** 시간을 끝까지 채운 판을 기록한다. 더 빨랐으면 최고 기록을 바꾼다 */
export function recordExam(
  mode: ExamMode,
  summary: Pick<ExamSummary, 'kpm' | 'accuracy'>,
  minutes: number,
  now = new Date(),
): { records: ExamRecords; isBest: boolean; previous: ExamBest | null } {
  const records = loadExamRecords();
  const prev = records[mode];
  const previous = prev?.best ?? null;
  const faster = summary.kpm > 0 && (previous === null || summary.kpm > previous.kpm);
  const best: ExamBest | null = faster
    ? { kpm: summary.kpm, accuracy: summary.accuracy, minutes, at: now.toISOString() }
    : previous;
  const updated: ExamRecords = { ...records, [mode]: { plays: (prev?.plays ?? 0) + 1, best } };
  try {
    localStorage.setItem(EXAM_KEY, JSON.stringify(updated));
  } catch {
    // 저장하지 못해도 결과 화면은 보여 준다.
  }
  return { records: updated, isBest: faster, previous };
}
