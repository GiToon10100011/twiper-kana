import { tokenizeKana } from '../kana/tokenize';
import { parseRuby, rubySurface } from '../text/ruby';
import { createRng, shuffled, type Rng } from './random';
import type { DrillRetry, DrillSpec, DrillState, LineResult } from './types';

/** 기본 줄을 다 풀고도 다시 낼 단위가 남았을 때 덧붙이는 최대 줄 수 */
const MAX_EXTRA_LINES = 2;

/**
 * 같은 단위가 붙지 않게 늘어놓는다. 토글 입력에서 같은 키 연타는 다른 글자가 되기 때문이다.
 * 남은 칸의 절반을 넘는 단위는 지금 놓아야 하므로 먼저 놓고, 아니면 섞인 순서를 따른다.
 */
function arrange(units: readonly string[]): string[] {
  const rest = [...units];
  const out: string[] = [];
  while (rest.length > 0) {
    const prev = out.at(-1);
    const count = (unit: string) => rest.filter((u) => u === unit).length;
    const forced = rest.find((u) => u !== prev && count(u) * 2 > rest.length);
    const i = forced !== undefined ? rest.indexOf(forced) : rest.findIndex((u) => u !== prev);
    out.push(...rest.splice(Math.max(i, 0), 1));
  }
  return out;
}

/** 복습 단위를 고른다. 이 줄에 아직 없는 단위를 우선한다. */
function drawReview(spec: DrillSpec, rng: Rng, line: readonly string[]): string {
  const unused = spec.review.filter((unit) => !line.includes(unit));
  const pool = unused.length > 0 ? unused : spec.review;
  return pool[rng.int(pool.length)] ?? '';
}

/** 이번 레벨 단위를 섞은 주머니에서 하나씩 꺼낸다. 비면 다시 채워 모든 단위가 고르게 나오게 한다. */
function drawFocus(bag: string[], spec: DrillSpec, rng: Rng): string {
  if (bag.length === 0) bag.push(...shuffled(spec.focus, rng));
  return bag.shift() ?? '';
}

function pickWord(words: readonly string[], rng: Rng, previous: string): string {
  const i = rng.int(words.length);
  const word = words[i] ?? '';
  return word === previous && words.length > 1 ? (words[(i + 1) % words.length] ?? '') : word;
}

/**
 * 줄에서 indexes(글자 위치)가 가리키는 출제 단위. 같은 단위는 한 번만.
 * 글자 위치는 입력 세션처럼 한자 표기를 읽기로 펼쳐 센다 ({時々|ときどき}는 4글자)
 */
function unitsAt(units: readonly string[], indexes: readonly number[]): string[] {
  const out: string[] = [];
  let start = 0;
  for (const unit of units) {
    const end = start + parseRuby(unit).chars.length;
    if (indexes.some((i) => i >= start && i < end) && !out.includes(unit)) out.push(unit);
    start = end;
  }
  return out;
}

interface NextLine {
  units: string[];
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
  const due = retries.filter((retry) => extra || retry.due <= index);
  const words = spec.words ?? [];
  const wordsOnly = spec.focus.length === 0;

  if (words.length > 0 && (wordsOnly || (!extra && index % 2 === 1))) {
    // 다시 낼 단위가 든 단어가 있으면 그 단어로 다시 낸다.
    for (const retry of due) {
      const matches = words.filter(
        (word) => word !== previous && tokenizeKana(word).includes(retry.unit),
      );
      const word = matches[rng.int(matches.length)];
      if (word !== undefined) {
        return { units: tokenizeKana(word), retries: retries.filter((r) => r !== retry) };
      }
    }
    return { units: tokenizeKana(pickWord(words, rng, previous)), retries: [...retries] };
  }

  // 기본 줄에서는 줄의 절반까지만 다시 내고, 추가 줄에서는 남은 것을 모두 낸다.
  const taken = due.slice(0, extra ? spec.lineLength : Math.floor(spec.lineLength / 2));
  const units = taken.map((retry) => retry.unit);
  while (units.length < spec.lineLength) {
    const review = spec.review.length > 0 && rng.next() < spec.reviewRatio;
    units.push(review ? drawReview(spec, rng, units) : drawFocus(bag, spec, rng));
  }
  return {
    units: arrange(shuffled(units, rng)),
    retries: retries.filter((retry) => !taken.includes(retry)),
  };
}

function schedule(
  retries: readonly DrillRetry[],
  missed: readonly string[],
  index: number,
  rng: Rng,
): DrillRetry[] {
  const out = [...retries];
  for (const unit of missed) {
    if (out.some((retry) => retry.unit === unit)) continue;
    out.push({ unit, due: index + 2 + rng.int(3) });
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
    line: first.units.join(''),
    lineUnits: first.units,
    results: [],
    retries: first.retries,
    bag,
    done: false,
  };
}

/**
 * 지금 줄의 결과를 기록하고 다음 줄을 낸다.
 * 틀린 글자는 그 글자가 속한 출제 단위로 바꿔 기록하고(요음 'きゃ'의 ゃ → 'きゃ'),
 * 2–4줄 뒤에 다시 낸다. 기본 줄이 끝날 때 남아 있으면 최대 MAX_EXTRA_LINES 줄을 덧붙인다.
 */
export function advanceDrill(state: DrillState, result: LineResult): DrillState {
  if (state.done) return state;
  const { spec } = state;
  const rng = createRng(state.rng);
  const index = state.results.length;
  const missed = unitsAt(state.lineUnits, result.missedIndexes);
  // 결과에는 보이는 표기로 남기고({時々|ときどき} → 時々), 다시 낼 때는 단어를 찾도록 표기째 쓴다
  const results = [...state.results, { ...result, missed: missed.map(rubySurface) }];
  const retries = schedule(state.retries, missed, index, rng);
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
    line: next.units.join(''),
    lineUnits: next.units,
    results,
    retries: next.retries,
    bag,
    done: false,
  };
}
