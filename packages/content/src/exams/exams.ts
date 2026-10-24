import type { ExamMode, ExamSource } from '@twiper/core';
import { levels } from '../courses/levels';
import { dakutenWords, handakutenWords, sokuonWords, yoonWords } from '../words/combos';
import { hiraganaWords } from '../words/hiragana';
import { foreignWords, katakanaWords, longVowelWords } from '../words/katakana';
import { longPassages, shortSentences } from './sentences';

export const EXAM_MODES: readonly ExamMode[] = ['kana', 'word', 'short', 'long'];

/** 글자 테스트 한 줄의 단위 수 */
const KANA_LINE_LENGTH = 5;

/**
 * 글자 테스트의 출제 단위: 기초·조합 레벨에서 익힌 단위 전부.
 * 가타카나 한 글자는 플릭이 아니라 후보 찾기 연습이 되므로 내지 않는다 (계획 §5).
 */
export const examKanaUnits: readonly string[] = [
  ...new Set(levels.filter((level) => level.stage !== 'katakana').flatMap((l) => l.drill.focus)),
];

/** 단어 테스트: 모든 레벨의 단어. 가타카나 단어는 변환해서 確定한다 */
export const examWords: readonly string[] = [
  ...new Set([
    ...hiraganaWords,
    ...dakutenWords,
    ...handakutenWords,
    ...yoonWords,
    ...sokuonWords,
    ...katakanaWords,
    ...longVowelWords,
    ...foreignWords,
  ]),
];

export function examSource(mode: ExamMode): ExamSource {
  switch (mode) {
    case 'kana':
      return { mode, units: examKanaUnits, lineLength: KANA_LINE_LENGTH };
    case 'word':
      return { mode, items: examWords };
    case 'short':
      return { mode, items: shortSentences };
    case 'long':
      return { mode, passages: longPassages };
  }
}
