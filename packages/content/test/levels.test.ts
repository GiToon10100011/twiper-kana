import { describe, expect, it } from 'vitest';
import { KANA_KEY_ROWS, advanceDrill, createDrill, type LineResult } from '@twiper/core';
import { findLevel, hiraganaWords, levels, nextLevel } from '../src/index';

const BASIC_KANA = new Set(KANA_KEY_ROWS.flat().filter((char) => char !== 'ー'));

const perfect = (line: string): LineResult => ({
  target: line,
  units: Array.from(line).length,
  firstTryUnits: Array.from(line).length,
  missed: [],
  reactionMs: 0,
  elapsedMs: 1000,
  romajiSuspected: false,
  toggleSuspected: false,
});

describe('levels', () => {
  it('L1부터 L10까지 번호와 id가 차례로 이어진다', () => {
    expect(levels.map((level) => level.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `L${i + 1}`),
    );
    expect(levels.map((level) => level.number)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
  });

  it('행별 레벨은 기본 가나 46자를 한 번씩 나눠 맡는다', () => {
    const focus = levels.filter((level) => level.kind === 'row').flatMap((l) => l.drill.focus);

    expect(focus).toHaveLength(46);
    expect(new Set(focus)).toEqual(BASIC_KANA);
  });

  it('행별 레벨의 각 행은 12키의 키 하나와 같다 (L9는 ら·わ 두 키)', () => {
    for (const level of levels.filter((l) => l.kind === 'row')) {
      const rows = new Set(
        level.drill.focus.map((char) => KANA_KEY_ROWS.findIndex((row) => row.includes(char))),
      );

      expect(rows.size).toBe(level.keys.length);
    }
  });

  it('복습 문자는 이전 레벨까지의 문자 전부다', () => {
    levels
      .filter((level) => level.kind === 'row')
      .forEach((level, i, rows) => {
        expect(level.drill.review).toEqual(rows.slice(0, i).flatMap((l) => l.drill.focus));
      });
  });

  it('모든 레벨을 끝까지 풀 수 있고, 줄에는 기본 가나만 나온다', () => {
    for (const level of levels) {
      let state = createDrill(level.drill, 42);
      while (!state.done) state = advanceDrill(state, perfect(state.line));
      const chars = state.results.flatMap((r) => Array.from(r.target));

      expect(state.results.length).toBe(level.drill.lineCount);
      expect(chars.filter((char) => !BASIC_KANA.has(char))).toEqual([]);
    }
  });

  it('findLevel·nextLevel', () => {
    expect(findLevel('L3')?.keys).toEqual(['さ']);
    expect(findLevel('L99')).toBeUndefined();
    expect(nextLevel('L9')?.id).toBe('L10');
    expect(nextLevel('L10')).toBeUndefined();
  });
});

describe('hiraganaWords', () => {
  it('기본 가나만 쓴다 (탁음·작은 가나·장음 없음)', () => {
    const invalid = hiraganaWords.filter((word) =>
      Array.from(word).some((char) => !BASIC_KANA.has(char)),
    );

    expect(invalid).toEqual([]);
  });

  it('겹치는 단어가 없고 60개 이상이다', () => {
    expect(new Set(hiraganaWords).size).toBe(hiraganaWords.length);
    expect(hiraganaWords.length).toBeGreaterThanOrEqual(60);
  });
});
