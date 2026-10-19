import type { InputSessionState } from '../input/types';
import { classifyMistake, type MistakeKind } from '../kana/classify';
import type { DrillSummary, LineResult } from './types';

type KindCounts = Partial<Record<MistakeKind, number>>;

const addKind = (counts: KindCounts, kind: MistakeKind, n = 1) => {
  counts[kind] = (counts[kind] ?? 0) + n;
};

/** 끝난 입력 세션을 줄 결과로 바꾼다. shownAt은 줄이 나타난 시각 (세션 스냅샷과 같은 시계) */
export function lineResultOf(session: InputSessionState, shownAt: number): LineResult {
  // 목표 길이를 넘어선 초과 입력(expected '')은 특정 글자를 놓친 것이 아니므로 뺀다.
  const missedAt = [
    ...new Set(session.errors.filter((e) => e.expected !== '').map((e) => e.index)),
  ].sort((a, b) => a - b);
  const since = (t: number | null) => (t === null ? null : Math.max(0, t - shownAt));
  return {
    target: session.target.join(''),
    units: session.target.length,
    firstTryUnits: session.target.length - missedAt.length,
    missed: missedAt.map((i) => session.target[i] ?? ''),
    missedIndexes: missedAt,
    mistakeKinds: session.errors.reduce<KindCounts>((counts, error) => {
      addKind(counts, classifyMistake(error.expected, error.actual));
      return counts;
    }, {}),
    reactionMs: since(session.startedAt),
    elapsedMs: since(session.matchedAt),
    romajiSuspected: session.romajiSuspected,
    toggleSuspected: session.toggleSuspected,
  };
}

export function summarizeDrill(results: readonly LineResult[]): DrillSummary {
  let units = 0;
  let firstTryUnits = 0;
  let totalMs = 0;
  let timedUnits = 0;
  const counts = new Map<string, number>();
  const mistakeKinds: KindCounts = {};
  for (const result of results) {
    units += result.units;
    firstTryUnits += result.firstTryUnits;
    if (result.elapsedMs !== null) {
      totalMs += result.elapsedMs;
      timedUnits += result.units;
    }
    for (const char of result.missed) counts.set(char, (counts.get(char) ?? 0) + 1);
    for (const [kind, n] of Object.entries(result.mistakeKinds) as [MistakeKind, number][]) {
      addKind(mistakeKinds, kind, n);
    }
  }
  // sort는 안정 정렬이라 횟수가 같으면 먼저 틀린 글자가 앞에 남는다.
  const missed = [...counts]
    .map(([char, count]) => ({ char, count }))
    .sort((a, b) => b.count - a.count);
  return {
    lines: results.length,
    units,
    firstTryUnits,
    accuracy: units > 0 ? firstTryUnits / units : 0,
    kpm: totalMs > 0 ? timedUnits / (totalMs / 60_000) : null,
    totalMs,
    missed,
    mistakeKinds,
    romajiSuspected: results.some((result) => result.romajiSuspected),
    toggleSuspected: results.some((result) => result.toggleSuspected),
  };
}
