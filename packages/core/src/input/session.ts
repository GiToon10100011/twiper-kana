import { sameKeyRow } from '../kana/rows';
import { toHiragana } from '../kana/script';
import { sameVariantFamily } from '../kana/variants';
import { normalizeBase, normalizeForCompare } from '../text/normalize';
import type {
  CharStatus,
  InputError,
  InputSessionOptions,
  InputSessionState,
  InputSnapshot,
  JudgeMode,
  PendingStep,
} from './types';

// 반각 A–Z·a–z와 전각 Ａ–Ｚ(U+FF21–FF3A)·ａ–ｚ(U+FF41–FF5A)
const LATIN_LETTER = /[A-Za-z\u{FF21}-\u{FF3A}\u{FF41}-\u{FF5A}]/u;

const toChars = (text: string): string[] => Array.from(text);

const isLatinLetter = (char: string): boolean => LATIN_LETTER.test(char);

type Same = (a: string, b: string) => boolean;

const sameChar: Same = (a, b) => a === b;

/** 읽기가 같으면 true (カ와 か). commit 판정은 조합 중 읽기를 이 기준으로 맞춰 본다 */
const sameReading: Same = (a, b) => a === b || toHiragana(a) === toHiragana(b);

const sameFor = (judge: JudgeMode): Same => (judge === 'commit' ? sameReading : sameChar);

function commonPrefixLength(
  a: readonly string[],
  b: readonly string[],
  same: Same = sameChar,
): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && same(a[i] ?? '', b[i] ?? '')) i += 1;
  return i;
}

const HAN = /\p{Script=Han}/u;
// 반각 가타카나 ･–ﾟ (U+FF65–FF9F). かな 키보드로는 직접 칠 수 없고 변환 후보로만 나온다
const HALFWIDTH_KATAKANA = /[\u{FF65}-\u{FF9F}]/u;

const isCandidateChar = (char: string): boolean => HAN.test(char) || HALFWIDTH_KATAKANA.test(char);

/**
 * 조합 중에 한자나 반각 가타카나가 보이면 변환 후보를 고르는 중이다. 읽기와 비교할 수 없으므로 오류를 세지 않는다.
 * 「、 같은 기호는 플릭으로 잘못 친 것일 수 있어 그대로 비교한다. 라틴 문자는 로마자 키보드 추정에 쓰므로 후보로 보지 않는다.
 */
const isConverting = (value: readonly string[], composing: boolean): boolean =>
  composing && value.some(isCandidateChar);

export function createInputSession(
  target: string,
  judge: JudgeMode = 'composing',
  options: InputSessionOptions = {},
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
    matchedAt: null,
    completedAt: null,
    completeOnCommit: options.completeOnCommit ?? false,
    romajiSuspected: false,
    toggleSuspected: false,
  };
}

/**
 * 스냅샷 하나를 반영한다.
 * composing 판정은 글자 그대로, commit 판정은 읽기(히라가나)로 목표와 맞춰 보며 플릭 오류를 찾는다.
 * commit 판정은 確定한 값이 목표 표기와 같아야 완료이고, 다른 표기로 確定한 글자도 오류로 기록한다.
 */
export function reduceInputSession(
  state: InputSessionState,
  snapshot: InputSnapshot,
): InputSessionState {
  if (state.completedAt !== null) return state;

  const { target, judge } = state;
  const { t } = snapshot;
  const same = sameFor(judge);
  const prev = state.value;
  const next = toChars(normalizeBase(snapshot.value));
  const startedAt = state.startedAt ?? (next.length > 0 ? t : null);
  const matched = commonPrefixLength(next, target, same);
  const equalsTarget =
    next.length === target.length && commonPrefixLength(next, target) === target.length;
  // 한자 후보를 고르는 동안에는 읽기와 비교할 수 없으므로 오류를 기록하지 않는다.
  const converting = judge === 'commit' && isConverting(next, snapshot.composing);
  // commit 판정에서 確定한 순간의 틀린 글자는 아래에서 한꺼번에 'committed'로 기록한다.
  const committing = judge === 'commit' && !snapshot.composing;

  const common = commonPrefixLength(prev, next, same);
  // next가 prev의 접두사일 때만 "지웠다"로 본다. 같은 스냅샷에서 끝 글자가 다른 글자로
  // 바뀐 경우(탁점 순환 は→ば→ぱ, 토글 あ→い, 로마자 k→か)는 입력 중간 상태다.
  const pureDeletion = next.length === common && prev.length > common;
  const errors: InputError[] = [...state.errors];

  if (pureDeletion) {
    for (let i = common; i < prev.length; i += 1) {
      const actual = prev[i] ?? '';
      const expected = target[i] ?? '';
      if (!same(actual, expected) && state.flagged[i] !== actual) {
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
    const continued = i < last && !same(actual, expected) && !converting && !committing;
    if (!alreadyFlagged && continued) {
      errors.push({ index: i, expected, actual, cause: 'continued', t });
    }
    flagged.push(alreadyFlagged || continued ? actual : null);
  }

  // commit 판정에서 確定한 값이 목표 표기와 다르면(히라가나 그대로, 다른 한자) 그 글자들을 기록한다.
  if (committing) {
    for (let i = 0; i <= last; i += 1) {
      const actual = next[i] ?? '';
      const expected = target[i] ?? '';
      if (actual === expected || flagged[i] === actual) continue;
      errors.push({ index: i, expected, actual, cause: 'committed', t });
      flagged[i] = actual;
    }
  }

  const lastReplacedInPlace = last >= 0 && prev.length === next.length && common === last;
  const toggled = lastReplacedInPlace && sameKeyRow(prev[last] ?? '', next[last] ?? '');
  const romaji = !target.some(isLatinLetter) && next.some(isLatinLetter);
  const committedMatch = equalsTarget && !snapshot.composing;
  const commit = judge === 'commit';

  return {
    ...state,
    value: next,
    composing: snapshot.composing,
    matched,
    errors,
    flagged,
    unitTimes: state.unitTimes.map((time, i) => (i < matched ? (time ?? t) : null)),
    startedAt,
    // commit 판정은 確定 시각이 정답 시각이다. 후보에서 골라 변환하는 것까지 실력에 넣는다.
    matchedAt: commit
      ? committedMatch
        ? t
        : null
      : (state.matchedAt ?? (equalsTarget ? t : null)),
    completedAt: (commit || state.completeOnCommit ? committedMatch : equalsTarget) ? t : null,
    romajiSuspected: state.romajiSuspected || romaji,
    toggleSuspected: state.toggleSuspected || toggled,
  };
}

/** 녹화한 스냅샷 열을 처음부터 재생한다. */
export function replayInputSession(
  target: string,
  snapshots: readonly InputSnapshot[],
  judge: JudgeMode = 'composing',
  options: InputSessionOptions = {},
): InputSessionState {
  return snapshots.reduce(reduceInputSession, createInputSession(target, judge, options));
}

/** 목표의 각 문자를 화면에 어떻게 표시할지 */
export function charStatuses(state: InputSessionState): CharStatus[] {
  const last = state.value.length - 1;
  const commit = state.judge === 'commit';
  const converting = commit && isConverting(state.value, state.composing);
  return state.target.map((expected, i) => {
    const actual = state.value[i];
    if (actual === undefined) return 'todo';
    if (actual === expected) return 'correct';
    if (commit) {
      // 確定한 글자가 목표 표기와 다르다 (히라가나 그대로, 다른 한자)
      if (!state.composing) return 'wrong';
      // 읽기는 맞다. 변환은 確定할 때 본다
      if (sameReading(actual, expected)) return 'correct';
      if (converting) return 'pending';
    }
    // 끝 글자가 아직 목표로 바뀔 수 있는 중간 상태(か→が, つ→っ, 로마자 k)면 보류하고,
    // 그럴 수 없으면 오타로 바로 보여 준다. 오류 기록 시점(확정·삭제)은 reduceInputSession이 정한다.
    const intermediate =
      sameVariantFamily(toHiragana(actual), toHiragana(expected)) || isLatinLetter(actual);
    return i === last && intermediate ? 'pending' : 'wrong';
  });
}

/** 다음 문제로 넘어가기 전에 사용자가 해야 할 일. 없으면 null */
export function pendingStep(state: InputSessionState): PendingStep | null {
  if (state.completedAt !== null) return null;
  if (state.judge === 'composing') return state.matchedAt !== null ? 'commit' : null;

  const { target, value } = state;
  const full = value.length === target.length;
  if (state.composing) {
    if (full && value.every((char, i) => char === target[i])) return 'commit';
    return full && state.matched === target.length ? 'convert' : null;
  }
  return value.some((char, i) => char !== target[i]) ? 'fix' : null;
}
