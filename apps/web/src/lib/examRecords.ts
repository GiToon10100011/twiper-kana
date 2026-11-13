import {
  mergeExamRecord,
  type ExamBest,
  type ExamMode,
  type ExamRecord,
  type ExamRecords,
  type ExamSummary,
} from '@twiper/core';
import type { SpeedUnit } from './settings';

const EXAM_KEY = 'twiper.exams.v1';

export type { ExamBest, ExamRecord, ExamRecords } from '@twiper/core';

/** 종합 테스트 세션의 levelId (세션으로 응시 횟수를 센다) */
export const examLevelId = (mode: ExamMode): string => `test-${mode}`;

const isBest = (value: unknown): value is ExamBest => {
  if (typeof value !== 'object' || value === null) return false;
  const best = value as Record<string, unknown>;
  return (
    typeof best.kpm === 'number' &&
    (best.wpm === undefined || typeof best.wpm === 'number') &&
    typeof best.accuracy === 'number' &&
    typeof best.minutes === 'number' &&
    typeof best.at === 'string'
  );
};

const isRecord = (value: unknown): value is ExamRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.plays === 'number' &&
    (record.best === null || isBest(record.best)) &&
    (record.romajiBest === undefined ||
      (isBest(record.romajiBest) && typeof record.romajiBest.wpm === 'number'))
  );
};

/** 고른 속도 단위로 본 최고 기록: 가나/분이면 가나/분이, CPM·WPM이면 로마자 속도가 가장 빨랐던 판 */
export const bestIn = (unit: SpeedUnit, record: ExamRecord | null | undefined): ExamBest | null =>
  (unit === 'kpm' ? record?.best : record?.romajiBest) ?? null;

// 브라우저 저장소를 쓸 수 없어도(사생활 보호 모드 등) 테스트는 할 수 있어야 하므로 실패는 삼킨다.

/** 저장해 둔 값이나 가져온 백업 파일에서 종목별 기록만 골라낸다 */
export function parseExamRecords(value: unknown): ExamRecords {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, record]) => isRecord(record)));
}

export function loadExamRecords(): ExamRecords {
  try {
    const raw = localStorage.getItem(EXAM_KEY);
    return raw ? parseExamRecords(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** 저장했으면 true. 저장 공간이 차는 등으로 쓰지 못하면 false */
function saveExamRecords(records: ExamRecords): boolean {
  try {
    localStorage.setItem(EXAM_KEY, JSON.stringify(records));
    return true;
  } catch {
    // 저장하지 못해도 결과 화면은 보여 준다.
    return false;
  }
}

/**
 * 시간을 끝까지 채운 판을 기록한다. 가나/분·로마자 속도가 각각 더 빨랐으면 그 최고 기록을 바꾼다.
 * faster는 어느 쪽 최고 기록을 바꿨는지, previous는 이 판 전의 기록이다
 */
export function recordExam(
  mode: ExamMode,
  summary: Pick<ExamSummary, 'kpm' | 'accuracy' | 'wpm'>,
  minutes: number,
  now = new Date(),
): {
  records: ExamRecords;
  faster: { readonly kana: boolean; readonly romaji: boolean };
  previous: ExamRecord | null;
} {
  const records = loadExamRecords();
  const previous = records[mode] ?? null;
  const play = {
    kpm: summary.kpm,
    accuracy: summary.accuracy,
    minutes,
    at: now.toISOString(),
  };
  const wpm = summary.wpm ?? 0;
  const kana = summary.kpm > 0 && (!previous?.best || summary.kpm > previous.best.kpm);
  const romaji = wpm > 0 && (!previous?.romajiBest || wpm > previous.romajiBest.wpm);
  const best = kana ? { ...play, ...(wpm > 0 ? { wpm } : {}) } : (previous?.best ?? null);
  const romajiBest = romaji ? { ...play, wpm } : previous?.romajiBest;
  const updated: ExamRecords = {
    ...records,
    [mode]: { plays: (previous?.plays ?? 0) + 1, best, ...(romajiBest ? { romajiBest } : {}) },
  };
  saveExamRecords(updated);
  return { records: updated, faster: { kana, romaji }, previous };
}

/**
 * 백업 파일의 종목별 기록을 합친다. 최고 기록은 가나/분·로마자 속도마다 빠른 쪽을 남겨
 * 같은 파일을 두 번 합쳐도 그대로다. 응시 횟수는 합친 뒤 끝난 세션 수와 옛 횟수로 다시 센다 (lib/plays). 바뀐 종목 수와, 바뀐 기록을 저장했는지(바뀐 게 없으면 true)를 돌려준다
 */
export function mergeExamRecords(incoming: ExamRecords): { changed: number; persisted: boolean } {
  const records = loadExamRecords();
  const merged: Partial<Record<string, ExamRecord>> = { ...records };
  let changed = 0;
  for (const [mode, record] of Object.entries(incoming)) {
    const prev = merged[mode];
    const next: ExamRecord = prev ? mergeExamRecord(prev, record) : record;
    if (
      prev &&
      prev.plays === next.plays &&
      prev.best === next.best &&
      prev.romajiBest === next.romajiBest
    ) {
      continue;
    }
    merged[mode] = next;
    changed += 1;
  }
  return { changed, persisted: changed === 0 || saveExamRecords(merged) };
}

/** 종목마다 응시 횟수를 playsOf(종목)으로 바꾼다. 바뀐 종목 수와, 저장했는지를 돌려준다 */
export function replaceExamPlays(playsOf: (mode: ExamMode) => number): {
  changed: number;
  persisted: boolean;
} {
  const records = loadExamRecords();
  const updated: Partial<Record<ExamMode, ExamRecord>> = { ...records };
  let changed = 0;
  for (const [mode, record] of Object.entries(records) as [ExamMode, ExamRecord][]) {
    const plays = playsOf(mode);
    if (plays === record.plays) continue;
    updated[mode] = { ...record, plays };
    changed += 1;
  }
  return { changed, persisted: changed === 0 || saveExamRecords(updated) };
}
