import { createRng } from '../drill/random';
import { lineResultOf, summarizeDrill } from '../drill/result';
import type { DrillSummary, LineResult } from '../drill/types';
import type { InputSessionState, JudgeMode } from '../input/types';
import { classifyMistake, type MistakeKind } from '../kana/classify';
import { toHiragana } from '../kana/script';
import { parseRuby } from '../text/ruby';

/** 종합 테스트 종목: 글자 / 단어 / 짧은 글 / 긴 글 */
export type ExamMode = 'kana' | 'word' | 'short' | 'long';

/**
 * 테스트 출제 재료. 콘텐츠 패키지가 만든다.
 * 단어·문장의 /는 어절 경계다. 목표에서는 빼고 화면에만 틈으로 보인다.
 * 한자는 {표기|읽기}로 적는다 (/는 표기 안에 두지 않는다).
 */
export type ExamSource =
  | { readonly mode: 'kana'; readonly units: readonly string[]; readonly lineLength: number }
  | { readonly mode: 'word' | 'short'; readonly items: readonly string[] }
  | { readonly mode: 'long'; readonly passages: readonly (readonly string[])[] };

export interface ExamLine {
  /** 칠 목표. 한자 표기는 {표기|읽기} 그대로 둔다 */
  readonly text: string;
  /** 이 글자 위치 뒤에 틈을 두어 어절을 나눠 보인다 (한자는 읽기로 펼친 위치, code point 단위) */
  readonly gapsAfter: readonly number[];
  /** 가타카나·한자가 있으면 변환해서 確定해야 하므로 commit */
  readonly judge: JudgeMode;
}

export interface ExamState {
  readonly source: ExamSource;
  /** 난수 상태 */
  readonly rng: number;
  readonly line: ExamLine;
  /** 긴 글에서 이어질 줄. 글의 마지막 줄이거나 다른 종목이면 null */
  readonly upcoming: ExamLine | null;
  /** 최근에 낸 항목(긴 글은 글 번호). 곧바로 다시 내지 않는다 */
  readonly recent: readonly (string | number)[];
  /** 긴 글: 지금 글과 줄 위치 */
  readonly passage: { readonly index: number; readonly line: number } | null;
}

/**
 * 원문 한 줄('{今日|きょう}は/いい/{天気|てんき}。')을 목표와 어절 틈으로 나눈다.
 * 틈 위치는 입력 세션처럼 한자를 읽기로 펼쳐 센다 ({今日|きょう}は → 3글자 뒤)
 */
export function parseExamLine(raw: string): ExamLine {
  const gapsAfter: number[] = [];
  const segments = raw.split('/');
  let length = 0;
  segments.forEach((segment, i) => {
    length += parseRuby(segment).chars.length;
    if (i < segments.length - 1 && length > 0) gapsAfter.push(length - 1);
  });
  const text = segments.join('');
  const { chars, rubies } = parseRuby(text);
  const katakana = chars.some((char) => toHiragana(char) !== char);
  return { text, gapsAfter, judge: katakana || rubies.length > 0 ? 'commit' : 'composing' };
}

type Key = string | number;

/** 같은 항목을 다시 내기 전에 사이에 둘 개수. 항목이 적으면 줄인다 */
const recentWindow = (count: number) => Math.max(0, Math.min(10, Math.floor(count / 2)));

/** 최근에 낸 것을 빼고 하나 고른다. 다 빠지면 전체에서 고른다. [항목, 위치] */
function pick<T>(
  pool: readonly T[],
  recent: readonly Key[],
  key: (item: T, i: number) => Key,
  int: (n: number) => number,
): [T | undefined, number] {
  const all = pool.map((item, i) => [item, i] as const);
  const fresh = all.filter(([item, i]) => !recent.includes(key(item, i)));
  const from = fresh.length > 0 ? fresh : all;
  const chosen = from[int(from.length)];
  return chosen ? [chosen[0], chosen[1]] : [undefined, -1];
}

const remember = (recent: readonly Key[], key: Key, size: number): Key[] =>
  size === 0 ? [] : [...recent, key].slice(-size);

/** 다음 상태를 만든다. previous는 이어 쓰는 이전 상태(처음이면 null) */
function draw(source: ExamSource, rngState: number, previous: ExamState | null): ExamState {
  const rng = createRng(rngState);
  const recent = previous?.recent ?? [];

  if (source.mode === 'kana') {
    const units: string[] = [];
    for (let i = 0; i < source.lineLength; i += 1) {
      // 토글 입력에서 같은 키 연타는 다른 글자가 되므로 같은 단위를 바로 붙이지 않는다
      const prev = units[i - 1];
      const others = source.units.filter((unit) => unit !== prev);
      const from = others.length > 0 ? others : source.units;
      units.push(from[rng.int(from.length)] ?? '');
    }
    return {
      source,
      rng: rng.state,
      line: parseExamLine(units.join('')),
      upcoming: null,
      recent: [],
      passage: null,
    };
  }

  if (source.mode === 'long') {
    const at = previous?.passage;
    const current = at ? source.passages[at.index] : undefined;
    // 지금 글이 남았으면 다음 줄, 아니면 최근에 치지 않은 다른 글을 처음부터
    let index = at?.index ?? -1;
    let line = (at?.line ?? -1) + 1;
    let nextRecent: readonly Key[] = recent;
    if (!current || line >= current.length) {
      [, index] = pick(source.passages, recent, (_, i) => i, rng.int);
      line = 0;
      nextRecent = remember(recent, index, recentWindow(source.passages.length));
    }
    const passage = source.passages[index] ?? [];
    const upcoming = passage[line + 1];
    return {
      source,
      rng: rng.state,
      line: parseExamLine(passage[line] ?? ''),
      upcoming: upcoming === undefined ? null : parseExamLine(upcoming),
      recent: nextRecent,
      passage: { index, line },
    };
  }

  const [item = ''] = pick(source.items, recent, (value) => value, rng.int);
  return {
    source,
    rng: rng.state,
    line: parseExamLine(item),
    upcoming: null,
    recent: remember(recent, item, recentWindow(source.items.length)),
    passage: null,
  };
}

/** 테스트를 시작한다. 같은 씨앗이면 같은 줄이 나온다 (홈에 보인 첫 줄 그대로 시작) */
export function createExam(source: ExamSource, seed: number): ExamState {
  return draw(source, seed, null);
}

/** 다음 줄. 테스트는 시간이 끝날 때까지 끝없이 낸다 */
export function advanceExam(state: ExamState): ExamState {
  return draw(state.source, state.rng, state);
}

type KindCounts = Partial<Record<MistakeKind, number>>;

/** 시간이 끝났을 때 치던 줄. 맞게 친 데까지만 결과로 센다 */
export function partialLineResult(session: InputSessionState, shownAt: number): LineResult {
  const full = lineResultOf(session, shownAt);
  const matched = session.matched;
  const missedIndexes = full.missedIndexes.filter((i) => i < matched);
  return {
    ...full,
    target: session.target.slice(0, matched).join(''),
    units: matched,
    firstTryUnits: matched - missedIndexes.length,
    // 한자 읽기 자리에서 틀렸으면 그 표기(天気)로 보인다 (lineResultOf와 같은 순서)
    missed: full.missed.filter((_, k) => (full.missedIndexes[k] ?? matched) < matched),
    missedIndexes,
    mistakeKinds: session.errors
      .filter((error) => error.index < matched)
      .reduce<KindCounts>((counts, error) => {
        const kind = classifyMistake(error.expected, error.actual);
        counts[kind] = (counts[kind] ?? 0) + 1;
        return counts;
      }, {}),
  };
}

export interface ExamSummary extends DrillSummary {
  /** 테스트 시간 (ms) */
  readonly durationMs: number;
  /** 시간 안에 맞게 친 가나 수 ÷ 분. 確定을 누르는 시간까지 든 실제 속도다 */
  readonly kpm: number;
}

/** 끝낸 줄과 치던 줄로 테스트 결과를 낸다. lines는 끝까지 친 줄 수 */
export function summarizeExam(
  results: readonly LineResult[],
  partial: LineResult | null,
  durationMs: number,
): ExamSummary {
  const all = partial && partial.units > 0 ? [...results, partial] : [...results];
  const units = all.reduce((sum, r) => sum + r.units, 0);
  const firstTryUnits = all.reduce((sum, r) => sum + r.firstTryUnits, 0);
  return {
    ...summarizeDrill(all),
    lines: results.length,
    units,
    firstTryUnits,
    accuracy: units > 0 ? firstTryUnits / units : 0,
    kpm: durationMs > 0 ? units / (durationMs / 60_000) : 0,
    durationMs,
  };
}
