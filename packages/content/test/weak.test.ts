import { describe, expect, it } from 'vitest';
import {
  advanceDrill,
  createDrill,
  SKILL_ORDER,
  tokenizeKana,
  type LineResult,
} from '@twiper/core';
import { levelForSkill, weakDrill } from '../src/index';

const perfect = (line: string): LineResult => ({
  target: line,
  units: Array.from(line).length,
  firstTryUnits: Array.from(line).length,
  missed: [],
  missedIndexes: [],
  mistakeKinds: {},
  reactionMs: 0,
  elapsedMs: 1000,
  romajiSuspected: false,
  toggleSuspected: false,
});

describe('levelForSkill', () => {
  it('통계의 모든 규칙에 돌아갈 레벨이 있다 (행은 그 키의 행별 레벨, 규칙은 그 주제 레벨)', () => {
    expect(SKILL_ORDER.filter((skill) => levelForSkill(skill) === undefined)).toEqual([]);
    expect(levelForSkill('row:か')?.id).toBe('L2');
    expect(levelForSkill('row:わ')?.id).toBe('L9');
    expect(levelForSkill('handakuten')?.id).toBe('L12');
    expect(levelForSkill('longVowel')?.id).toBe('L17');
  });
});

describe('weakDrill', () => {
  it('약점 단위를 글자 줄로 내고, 그 단위가 든 히라가나 단어를 번갈아 낸다', () => {
    const spec = weakDrill(['ぱ', 'きゃ']);
    let state = createDrill(spec, 7);
    while (!state.done) state = advanceDrill(state, perfect(state.line));

    expect(spec.focus).toEqual(['ぱ', 'きゃ']);
    expect(spec.judge).toBeUndefined();
    expect((spec.words ?? []).length).toBeGreaterThan(0);
    expect(
      (spec.words ?? []).filter(
        (word) => !tokenizeKana(word).some((u) => ['ぱ', 'きゃ'].includes(u)),
      ),
    ).toEqual([]);
    expect(state.results).toHaveLength(spec.lineCount);
  });

  it('맞는 단어가 없으면 글자 줄만 낸다', () => {
    expect(weakDrill(['ゎ']).words).toBeUndefined();
  });
});
