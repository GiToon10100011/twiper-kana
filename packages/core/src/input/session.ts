import { sameKeyRow } from '../kana/rows';
import { normalizeBase, normalizeForCompare } from '../text/normalize';
import type { CharStatus, InputError, InputSessionState, InputSnapshot, JudgeMode } from './types';

// 반각 A–Z·a–z와 전각 Ａ–Ｚ(U+FF21–FF3A)·ａ–ｚ(U+FF41–FF5A)
const LATIN_LETTER = /[A-Za-z\u{FF21}-\u{FF3A}\u{FF41}-\u{FF5A}]/u;

const toChars = (text: string): string[] => Array.from(text);

const isLatinLetter = (char: string): boolean => LATIN_LETTER.test(char);

function commonPrefixLength(a: readonly string[], b: readonly string[]): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

export function createInputSession(
  target: string,
  judge: JudgeMode = 'composing',
): InputSessionState {
  const chars = toChars(normalizeForCompare(target));
  return {
    target: chars,
    judge,
    value: [],
    composing: false,
    matched: 0,
    errors: [],
    flagged: [],
    unitTimes: chars.map(() => null),
    startedAt: null,
    completedAt: null,
    romajiSuspected: false,
    toggleSuspected: false,
  };
}

export function reduceInputSession(
  state: InputSessionState,
  snapshot: InputSnapshot,
): InputSessionState {
  if (state.completedAt !== null) return state;

  const { target } = state;
  const { t } = snapshot;
  const prev = state.value;
  const next = toChars(normalizeBase(snapshot.value));
  const startedAt = state.startedAt ?? (next.length > 0 ? t : null);
  const matched = commonPrefixLength(next, target);
  const equalsTarget = matched === target.length && next.length === target.length;

  if (state.judge === 'commit') {
    // 변환이 필요한 목표는 조합 중 문자열(읽기)을 목표와 비교하지 않고 확정된 값만 판정한다.
    return {
      ...state,
      value: next,
      composing: snapshot.composing,
      matched,
      startedAt,
      completedAt: equalsTarget && !snapshot.composing ? t : null,
    };
  }

  const common = commonPrefixLength(prev, next);
  // next가 prev의 접두사일 때만 "지웠다"로 본다. 같은 스냅샷에서 끝 글자가 다른 글자로
  // 바뀐 경우(탁점 순환 は→ば→ぱ, 토글 あ→い, 로마자 k→か)는 입력 중간 상태다.
  const pureDeletion = next.length === common && prev.length > common;
  const errors: InputError[] = [...state.errors];

  if (pureDeletion) {
    for (let i = common; i < prev.length; i += 1) {
      const actual = prev[i] ?? '';
      const expected = target[i] ?? '';
      if (actual !== expected && state.flagged[i] !== actual) {
        errors.push({ index: i, expected, actual, cause: 'deleted', t });
      }
    }
  }

  // 마지막 글자는 아직 바뀔 수 있으므로 보류하고, 그 앞의 틀린 글자만 오류로 확정한다.
  const flagged: (string | null)[] = [];
  const last = next.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const actual = next[i] ?? '';
    const expected = target[i] ?? '';
    if (actual === expected) {
      flagged.push(null);
      continue;
    }
    const alreadyFlagged = i < common && state.flagged[i] === actual;
    if (!alreadyFlagged && i < last) {
      errors.push({ index: i, expected, actual, cause: 'continued', t });
    }
    flagged.push(alreadyFlagged || i < last ? actual : null);
  }

  const lastReplacedInPlace = last >= 0 && prev.length === next.length && common === last;
  const toggled = lastReplacedInPlace && sameKeyRow(prev[last] ?? '', next[last] ?? '');
  const romaji = !target.some(isLatinLetter) && next.some(isLatinLetter);

  return {
    ...state,
    value: next,
    composing: snapshot.composing,
    matched,
    errors,
    flagged,
    unitTimes: state.unitTimes.map((time, i) => (i < matched ? (time ?? t) : null)),
    startedAt,
    completedAt: equalsTarget ? t : null,
    romajiSuspected: state.romajiSuspected || romaji,
    toggleSuspected: state.toggleSuspected || toggled,
  };
}

/** 녹화한 스냅샷 열을 처음부터 재생한다. */
export function replayInputSession(
  target: string,
  snapshots: readonly InputSnapshot[],
  judge: JudgeMode = 'composing',
): InputSessionState {
  return snapshots.reduce(reduceInputSession, createInputSession(target, judge));
}

/** 목표의 각 문자를 화면에 어떻게 표시할지 */
export function charStatuses(state: InputSessionState): CharStatus[] {
  const last = state.value.length - 1;
  return state.target.map((expected, i) => {
    const actual = state.value[i];
    if (actual === undefined) return 'todo';
    if (state.judge === 'commit') return i < state.matched ? 'correct' : 'pending';
    if (actual === expected) return 'correct';
    return i === last ? 'pending' : 'wrong';
  });
}
