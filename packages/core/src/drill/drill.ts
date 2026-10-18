import { createRng, shuffled, type Rng } from './random';
import type { DrillRetry, DrillSpec, DrillState, LineResult } from './types';

/** 기본 줄을 다 풀고도 다시 낼 글자가 남았을 때 덧붙이는 최대 줄 수 */
const MAX_EXTRA_LINES = 2;

/**
 * 같은 글자가 붙지 않게 늘어놓는다. 토글 입력에서 같은 키 연타는 다른 글자가 되기 때문이다.
 * 남은 칸의 절반을 넘는 글자는 지금 놓아야 하므로 먼저 놓고, 아니면 섞인 순서를 따른다.
 */
function arrange(chars: readonly string[]): string[] {
  const rest = [...chars];
  const out: string[] = [];
  while (rest.length > 0) {
    const prev = out.at(-1);
    const count = (char: string) => rest.filter((c) => c === char).length;
    const forced = rest.find((c) => c !== prev && count(c) * 2 > rest.length);
    const i = forced !== undefined ? rest.indexOf(forced) : rest.findIndex((c) => c !== prev);
    out.push(...rest.splice(Math.max(i, 0), 1));
  }
  return out;
}

/** 복습 문자를 고른다. 이 줄에 아직 없는 문자를 우선한다. */
function drawReview(spec: DrillSpec, rng: Rng, line: readonly string[]): string {
  const unused = spec.review.filter((char) => !line.includes(char));
  const pool = unused.length > 0 ? unused : spec.review;
  return pool[rng.int(pool.length)] ?? '';
}

/** 이번 레벨 문자를 섞은 주머니에서 하나씩 꺼낸다. 비면 다시 채워 모든 문자가 고르게 나오게 한다. */
function drawFocus(bag: string[], spec: DrillSpec, rng: Rng): string {
  if (bag.length === 0) bag.push(...shuffled(spec.focus, rng));
  return bag.shift() ?? '';
}

function pickWord(words: readonly string[], rng: Rng, previous: string): string {
  const i = rng.int(words.length);
  const word = words[i] ?? '';
  return word === previous && words.length > 1 ? (words[(i + 1) % words.length] ?? '') : word;
}

interface NextLine {
  text: string;
  retries: DrillRetry[];
}

/** index번째 줄을 만든다. bag은 꺼낸 만큼 줄어든다. */
function nextLine(
  spec: DrillSpec,
  rng: Rng,
  bag: string[],
  retries: readonly DrillRetry[],
  index: number,
  previous: string,
): NextLine {
  const extra = index >= spec.lineCount;
  if (spec.words && spec.words.length > 0 && !extra && index % 2 === 1) {
    return { text: pickWord(spec.words, rng, previous), retries: [...retries] };
  }

  // 기본 줄에서는 줄의 절반까지만 다시 내고, 추가 줄에서는 남은 것을 모두 낸다.
  const limit = extra ? spec.lineLength : Math.floor(spec.lineLength / 2);
  const due = retries.filter((retry) => extra || retry.due <= index).slice(0, limit);
  const chars = due.map((retry) => retry.char);
  while (chars.length < spec.lineLength) {
    const review = spec.review.length > 0 && rng.next() < spec.reviewRatio;
    chars.push(review ? drawReview(spec, rng, chars) : drawFocus(bag, spec, rng));
  }
  return {
    text: arrange(shuffled(chars, rng)).join(''),
    retries: retries.filter((retry) => !due.includes(retry)),
  };
}

function schedule(
  retries: readonly DrillRetry[],
  missed: readonly string[],
  index: number,
  rng: Rng,
): DrillRetry[] {
  const out = [...retries];
  for (const char of missed) {
    if (out.some((retry) => retry.char === char)) continue;
    out.push({ char, due: index + 2 + rng.int(3) });
  }
  return out;
}

/** 줄 드릴을 시작한다. 같은 spec과 seed면 같은 줄을 같은 순서로 낸다. */
export function createDrill(spec: DrillSpec, seed: number): DrillState {
  const rng = createRng(seed);
  const bag: string[] = [];
  const first = nextLine(spec, rng, bag, [], 0, '');
  return {
    spec,
    rng: rng.state,
    line: first.text,
    results: [],
    retries: first.retries,
    bag,
    done: false,
  };
}

/**
 * 지금 줄의 결과를 기록하고 다음 줄을 낸다.
 * 틀린 글자는 2–4줄 뒤에 다시 내고, 기본 줄이 끝날 때 남아 있으면 최대 MAX_EXTRA_LINES 줄을 덧붙인다.
 */
export function advanceDrill(state: DrillState, result: LineResult): DrillState {
  if (state.done) return state;
  const { spec } = state;
  const rng = createRng(state.rng);
  const index = state.results.length;
  const results = [...state.results, result];
  const retries = schedule(state.retries, result.missed, index, rng);
  const nextIndex = index + 1;
  const done =
    nextIndex >= spec.lineCount &&
    (retries.length === 0 || nextIndex >= spec.lineCount + MAX_EXTRA_LINES);
  if (done) return { ...state, rng: rng.state, results, retries, done: true };

  const bag = [...state.bag];
  const next = nextLine(spec, rng, bag, retries, nextIndex, state.line);
  return {
    spec,
    rng: rng.state,
    line: next.text,
    results,
    retries: next.retries,
    bag,
    done: false,
  };
}
