import { describe, expect, it } from 'vitest';
import { advanceExam, createExam, parseExamLine } from '@twiper/core';
import {
  EXAM_MODES,
  examKanaUnits,
  examSource,
  examWords,
  levels,
  longPassages,
  shortSentences,
} from '../src/index';

/** 레벨에서 배우는 히라가나 전부 (조합 단위를 글자로 푼 것) */
const learnedHiragana = new Set(
  levels
    .filter((level) => level.stage !== 'katakana')
    .flatMap((level) => level.drill.focus.flatMap((unit) => Array.from(unit))),
);
const PUNCTUATION = new Set(['、', '。']);

const sentenceLines = [...shortSentences, ...longPassages.flat()];

describe('종합 테스트 콘텐츠', () => {
  it('짧은 글·긴 글은 배운 히라가나와 「、。」만 쓴다 (가타카나·한자·ー·공백 없음)', () => {
    const outside = sentenceLines.flatMap((line) =>
      Array.from(parseExamLine(line).text).filter(
        (char) => !learnedHiragana.has(char) && !PUNCTUATION.has(char),
      ),
    );

    expect(outside).toEqual([]);
  });

  it('어절 경계 /는 맨 앞·맨 뒤나 두 번 연달아 오지 않고, 문장은 。로 끝난다', () => {
    for (const line of sentenceLines) {
      expect(line).not.toMatch(/^\/|\/$|\/\//);
      expect(line.endsWith('。')).toBe(true);
    }
  });

  it('같은 짧은 글이 두 번 들어 있지 않고, 긴 글은 모두 네 줄 이상이다', () => {
    expect(new Set(shortSentences).size).toBe(shortSentences.length);
    expect(shortSentences.length).toBeGreaterThanOrEqual(60);
    expect(longPassages.length).toBeGreaterThanOrEqual(10);
    for (const passage of longPassages) expect(passage.length).toBeGreaterThanOrEqual(4);
  });

  it('글자 테스트는 기초·조합 레벨 단위를 모두 내고, 가타카나 한 글자는 내지 않는다', () => {
    expect(examKanaUnits).toContain('あ');
    expect(examKanaUnits).toContain('きゃ');
    expect(examKanaUnits).toContain('ぱ');
    expect(examKanaUnits.some((unit) => /[\u{30A1}-\u{30FA}]/u.test(unit))).toBe(false);
  });

  it('단어 테스트는 기호(짧은 말)·한자 단계를 뺀 모든 레벨의 단어를 겹치지 않게 담는다', () => {
    const notWords = new Set(['symbol', 'kanji']);
    const wordLevels = levels.filter((level) => !notWords.has(level.stage));
    const levelWords = new Set(wordLevels.flatMap((level) => level.drill.words ?? []));

    expect(new Set(examWords)).toEqual(levelWords);
  });

  it('네 종목 모두 끝없이 출제하고, 줄은 비지 않는다', () => {
    for (const mode of EXAM_MODES) {
      let state = createExam(examSource(mode), 11);
      for (let i = 0; i < 200; i += 1) {
        expect(state.line.text.length).toBeGreaterThan(0);
        // 작은 글자 단위(ゃ)가 앞 글자와 붙으면 한 소리로 묶이므로 글자 수로 본다
        if (mode === 'kana') expect(Array.from(state.line.text).length).toBeGreaterThanOrEqual(5);
        state = advanceExam(state);
      }
    }
  });
});
