import { sameKeyRow } from '../kana/rows';
import { toHiragana } from '../kana/script';
import { sameVariantFamily } from '../kana/variants';
import { normalizeBase, normalizeForCompare } from '../text/normalize';
import { parseRuby, type RubySpan } from '../text/ruby';
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

const sameChars = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((char, i) => char === b[i]);

/**
 * 입력값을 목표(한자 표기를 읽기로 펼친 것)에 맞춰 본다.
 * 앞에서부터 한자 표기 자리에 그 표기가 그대로 들어와 있으면 읽기로 되돌린다(時々 → ときどき).
 * 읽기 그대로면 그대로 맞는다. 다른 한자로 바꿨거나 어긋나면 거기서부터 그대로 두어 틀린 글자로 보이게 한다.
 */
function alignToTarget(
  raw: readonly string[],
  target: readonly string[],
  rubies: readonly RubySpan[],
): string[] {
  const value: string[] = [];
  let r = 0;
  for (const ruby of rubies) {
    while (value.length < ruby.start && r < raw.length) value.push(raw[r++] ?? '');
    if (value.length !== ruby.start) break;
    const surface = Array.from(ruby.surface);
    const reading = target.slice(ruby.start, ruby.end);
    if (sameChars(raw.slice(r, r + surface.length), surface)) {
      value.push(...reading);
      r += surface.length;
    } else if (sameChars(raw.slice(r, r + reading.length), reading)) {
      value.push(...reading);
      r += reading.length;
    } else {
      break;
    }
  }
  value.push(...raw.slice(r));
  return value;
}

/**
 * 목표 문자열로 입력 세션을 만든다. 한자는 `{時々|ときどき}`처럼 읽기를 붙여 쓴다.
 * 화면이 한자 위에 읽기(후리가나)를 보여 주므로 읽기를 가나로 치면 맞고, 그 한자로 변환해도 맞다
 * (플릭으로 읽기를 치는 것이 연습의 요점이다 — 사용자 결정 2026-10-25).
 */
export function createInputSession(
  target: string,
  judge: JudgeMode = 'composing',
  options: InputSessionOptions = {},
): InputSessionState {
  const { chars, surface, rubies } = parseRuby(normalizeForCompare(target));
  return {
    target: chars,
    surface: toChars(surface),
    rubies,
    judge,
    value: [],
    raw: [],
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

  const { target, rubies, judge } = state;
  const { t } = snapshot;
  const same = sameFor(judge);
  const prev = state.value;
  const raw = toChars(normalizeBase(snapshot.value));
  const next = alignToTarget(raw, target, rubies);
  const startedAt = state.startedAt ?? (next.length > 0 ? t : null);
  const matched = commonPrefixLength(next, target, same);
  const equalsTarget = sameChars(next, target);
  // 한자 후보를 고르는 동안에는 읽기와 비교할 수 없으므로 오류를 기록하지 않는다.
  // 목표 표기로 바르게 변환한 한자는 읽기로 되돌려 두었으므로 후보로 보지 않는다.
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
  const romaji = !target.some(isLatinLetter) && raw.some(isLatinLetter);
  const committedMatch = equalsTarget && !snapshot.composing;
  const commit = judge === 'commit';

  return {
    ...state,
    value: next,
    raw,
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
    if (sameChars(value, target)) return 'commit';
    return full && state.matched === target.length ? 'convert' : null;
  }
  return value.some((char, i) => char !== target[i]) ? 'fix' : null;
}
