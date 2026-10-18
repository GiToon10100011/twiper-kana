import { describe, expect, it } from 'vitest';
import {
  advanceDrill,
  createDrill,
  createInputSession,
  lineResultOf,
  reduceInputSession,
  summarizeDrill,
  type DrillSpec,
  type DrillState,
  type InputSessionState,
  type LineResult,
} from '../../src/index';

const A_ROW = Array.from('あいうえお');
const KA_ROW = Array.from('かきくけこ');

const spec = (overrides: Partial<DrillSpec> = {}): DrillSpec => ({
  focus: KA_ROW,
  review: A_ROW,
  lineLength: 5,
  lineCount: 8,
  reviewRatio: 0.3,
  ...overrides,
});

const perfect = (line: string): LineResult => ({
  target: line,
  units: Array.from(line).length,
  firstTryUnits: Array.from(line).length,
  missed: [],
  reactionMs: 500,
  elapsedMs: 3000,
  romajiSuspected: false,
  toggleSuspected: false,
});

const missing = (line: string, chars: string[]): LineResult => ({
  ...perfect(line),
  firstTryUnits: Array.from(line).length - chars.length,
  missed: chars,
});

function runPerfect(state: DrillState): DrillState {
  let current = state;
  while (!current.done) current = advanceDrill(current, perfect(current.line));
  return current;
}

/** 스냅샷을 차례로 넣어 세션을 만든다. 시각은 100ms 간격 */
function typed(target: string, values: [string, boolean][], from = 1000): InputSessionState {
  return values.reduce(
    (session, [value, composing], i) =>
      reduceInputSession(session, { t: from + i * 100, value, composing }),
    createInputSession(target, 'composing', { completeOnCommit: true }),
  );
}

describe('createDrill', () => {
  it('같은 시드면 같은 줄을 낸다', () => {
    expect(createDrill(spec(), 7).line).toBe(createDrill(spec(), 7).line);
  });

  it('줄 길이만큼의 글자를 대상 문자에서만 고른다', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const chars = Array.from(createDrill(spec(), seed).line);

      expect(chars).toHaveLength(5);
      expect(chars.every((char) => KA_ROW.includes(char) || A_ROW.includes(char))).toBe(true);
    }
  });

  it('같은 글자를 연달아 내지 않는다', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const lines = runPerfect(createDrill(spec(), seed)).results.map((r) => r.target);
      for (const line of lines) {
        const chars = Array.from(line);

        expect(chars.some((char, i) => i > 0 && char === chars[i - 1])).toBe(false);
      }
    }
  });

  it('복습 문자가 없으면 이번 레벨 문자만 낸다', () => {
    const chars = Array.from(createDrill(spec({ review: [] }), 3).line);

    expect(chars.every((char) => KA_ROW.includes(char))).toBe(true);
  });
});

describe('advanceDrill', () => {
  it('모두 맞히면 정해진 줄 수에서 끝난다', () => {
    const done = runPerfect(createDrill(spec(), 1));

    expect(done.results).toHaveLength(8);
    expect(done.done).toBe(true);
  });

  it('이번 레벨 문자는 기본 줄 안에서 한 번 이상 모두 나온다', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const text = runPerfect(createDrill(spec(), seed))
        .results.map((r) => r.target)
        .join('');

      expect(KA_ROW.filter((char) => !text.includes(char))).toEqual([]);
    }
  });

  it('복습 문자는 대략 정해진 비율로 섞인다', () => {
    let review = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const result of runPerfect(createDrill(spec(), seed)).results) {
        for (const char of result.target) {
          total += 1;
          if (A_ROW.includes(char)) review += 1;
        }
      }
    }

    expect(review / total).toBeGreaterThan(0.2);
    expect(review / total).toBeLessThan(0.4);
  });

  it('틀린 글자는 2–4줄 뒤에 다시 낸다', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const first = createDrill(spec({ reviewRatio: 0 }), seed);
      const missedChar = Array.from(first.line)[2] ?? '';
      let state = advanceDrill(first, missing(first.line, [missedChar]));
      const next: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        next.push(state.line);
        state = advanceDrill(state, perfect(state.line));
      }

      expect(next.slice(1).some((line) => line.includes(missedChar))).toBe(true);
    }
  });

  it('끝까지 남은 다시 낼 글자는 추가 줄에서 내고, 추가 줄은 2줄까지만 붙인다', () => {
    let state = createDrill(spec(), 5);
    while (!state.done) {
      const chars = Array.from(state.line);
      state = advanceDrill(state, missing(state.line, [chars[0] ?? '']));
    }

    expect(state.results).toHaveLength(10);
  });

  it('마지막 줄에서 틀린 글자는 추가 줄에 나온다', () => {
    let state = createDrill(spec(), 9);
    while (state.results.length < 7) state = advanceDrill(state, perfect(state.line));
    const missedChar = Array.from(state.line)[0] ?? '';
    state = advanceDrill(state, missing(state.line, [missedChar]));

    expect(state.done).toBe(false);
    expect(state.line).toContain(missedChar);

    state = advanceDrill(state, perfect(state.line));

    expect(state.done).toBe(true);
    expect(state.results).toHaveLength(9);
  });

  it('끝난 뒤에는 결과를 더 받지 않는다', () => {
    const done = runPerfect(createDrill(spec(), 1));

    expect(advanceDrill(done, perfect('かき'))).toBe(done);
  });

  it('단어가 있으면 기본 줄의 홀수 번째 줄은 단어 하나다', () => {
    const words = ['さくら', 'いぬ', 'ねこ'];
    const lines = runPerfect(createDrill(spec({ words }), 2)).results.map((r) => r.target);

    lines.forEach((line, i) => {
      expect(words.includes(line)).toBe(i % 2 === 1);
    });
  });
});

describe('lineResultOf', () => {
  it('한 번에 맞힌 줄은 모든 글자를 첫 시도 정답으로 센다', () => {
    const session = typed('かきく', [
      ['か', true],
      ['かき', true],
      ['かきく', true],
      ['かきく', false],
    ]);

    expect(lineResultOf(session, 500)).toEqual({
      target: 'かきく',
      units: 3,
      firstTryUnits: 3,
      missed: [],
      reactionMs: 500,
      elapsedMs: 700,
      romajiSuspected: false,
      toggleSuspected: false,
    });
  });

  it('틀렸다가 고친 글자는 위치마다 한 번씩 놓친 글자로 센다', () => {
    const session = typed('かきく', [
      ['か', true],
      ['かけ', true],
      ['かけく', true],
      ['かけ', true],
      ['か', true],
      ['かき', true],
      ['かきく', true],
      ['かきく', false],
    ]);
    const result = lineResultOf(session, 1000);

    expect(result.missed).toEqual(['き']);
    expect(result.firstTryUnits).toBe(2);
  });

  it('입력이 없으면 시간을 null로 둔다', () => {
    const result = lineResultOf(createInputSession('か'), 0);

    expect(result.reactionMs).toBeNull();
    expect(result.elapsedMs).toBeNull();
  });
});

describe('summarizeDrill', () => {
  it('첫 시도 정확도, 가나/분, 많이 틀린 글자를 모은다', () => {
    const summary = summarizeDrill([
      { ...missing('かきくけこ', ['き']), elapsedMs: 3000 },
      { ...missing('きかこけく', ['き', 'こ']), elapsedMs: 3000 },
    ]);

    expect(summary.lines).toBe(2);
    expect(summary.units).toBe(10);
    expect(summary.firstTryUnits).toBe(7);
    expect(summary.accuracy).toBeCloseTo(0.7);
    expect(summary.kpm).toBeCloseTo(100);
    expect(summary.totalMs).toBe(6000);
    expect(summary.missed).toEqual([
      { char: 'き', count: 2 },
      { char: 'こ', count: 1 },
    ]);
  });

  it('시간을 잴 수 없는 줄은 가나/분 계산에서 뺀다', () => {
    const summary = summarizeDrill([
      { ...perfect('かきくけこ'), elapsedMs: 6000 },
      { ...perfect('あいうえお'), elapsedMs: null },
    ]);

    expect(summary.kpm).toBeCloseTo(50);
  });

  it('결과가 없으면 0과 null', () => {
    const summary = summarizeDrill([]);

    expect(summary.accuracy).toBe(0);
    expect(summary.kpm).toBeNull();
  });

  it('로마자·토글 의심은 한 줄이라도 있으면 표시한다', () => {
    const summary = summarizeDrill([perfect('か'), { ...perfect('き'), romajiSuspected: true }]);

    expect(summary.romajiSuspected).toBe(true);
    expect(summary.toggleSuspected).toBe(false);
  });
});
