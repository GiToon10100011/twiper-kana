import type { DrillSpec } from '@twiper/core';
import { dakutenWords, handakutenWords, sokuonWords, yoonWords } from '../words/combos';
import { hiraganaWords } from '../words/hiragana';
import { katakanaWords, longVowelWords } from '../words/katakana';

/** 조합 단계에서 다루는 규칙. 모두 「小゛゜」 키로 만든다 */
export type ComboTopic = 'dakuten' | 'handakuten' | 'small' | 'yoon' | 'sokuon';

/** 가타카나 단계에서 다루는 규칙. 읽는 대로 친 뒤 변환 후보에서 골라 確定한다 */
export type KatakanaTopic = 'katakana' | 'longVowel';

export type LevelTopic = ComboTopic | KatakanaTopic;

export interface Level {
  /** URL과 저장에 쓰는 id */
  readonly id: string;
  readonly number: number;
  /** basic: 기초(50음) / combo: 문자 조합 / katakana: 가타카나 단어 (계획 §10.2) */
  readonly stage: 'basic' | 'combo' | 'katakana';
  /** row: 행별 연습 / all: 50음 전체 / combo: 조합 규칙 하나 / word: 변환해서 確定하는 단어 */
  readonly kind: 'row' | 'all' | 'combo' | 'word';
  /** 준비 화면에 도해로 보여 줄 키 (행의 첫 글자). 행별 레벨은 제목에도 쓴다 */
  readonly keys: readonly string[];
  /** 조합·가타카나 레벨의 규칙 */
  readonly topic?: LevelTopic;
  /** 실력 확인용 종합 레벨. 스스로 떠올리도록 상황별 도움말을 띄우지 않는다 */
  readonly assessment?: boolean;
  readonly drill: DrillSpec;
}

/** 기초 단계 L1–L9의 행. 12키의 키 하나가 한 행이다 */
const ROWS: readonly { keys: string; kana: string }[] = [
  { keys: 'あ', kana: 'あいうえお' },
  { keys: 'か', kana: 'かきくけこ' },
  { keys: 'さ', kana: 'さしすせそ' },
  { keys: 'た', kana: 'たちつてと' },
  { keys: 'な', kana: 'なにぬねの' },
  { keys: 'は', kana: 'はひふへほ' },
  { keys: 'ま', kana: 'まみむめも' },
  { keys: 'や', kana: 'やゆよ' },
  { keys: 'らわ', kana: 'らりるれろわをん' },
];

const LINE_LENGTH = 5;
const LINE_COUNT = 8;
/** 신규 70% + 이전 범위 30% (계획 §10.2) */
const REVIEW_RATIO = 0.3;

const chars = (text: string) => Array.from(text);

const rowLevels: Level[] = ROWS.map((row, i) => ({
  id: `L${i + 1}`,
  number: i + 1,
  stage: 'basic',
  kind: 'row',
  keys: chars(row.keys),
  drill: {
    focus: chars(row.kana),
    review: ROWS.slice(0, i).flatMap((prev) => chars(prev.kana)),
    lineLength: LINE_LENGTH,
    lineCount: LINE_COUNT,
    reviewRatio: REVIEW_RATIO,
  },
}));

const allKana = ROWS.flatMap((row) => chars(row.kana));

/** 요음: い단 + 작은 ゃゅょ. 탁음·반탁음 요음(ぎゃ じゃ びゃ ぴゃ)까지 */
const YOON = chars('きしちにひみりぎじびぴ').flatMap((head) =>
  chars('ゃゅょ').map((small) => head + small),
);

const combo = (
  number: number,
  topic: ComboTopic,
  drill: Partial<DrillSpec> & Pick<DrillSpec, 'focus'>,
): Level => ({
  id: `L${number}`,
  number,
  stage: 'combo',
  kind: 'combo',
  keys: [],
  topic,
  drill: {
    review: [],
    lineLength: LINE_LENGTH,
    lineCount: LINE_COUNT,
    reviewRatio: REVIEW_RATIO,
    ...drill,
  },
});

/**
 * 조합 단계 L11–L15. 복습 단위는 헷갈리기 쉬운 짝(が↔か, ぱ↔ば·は, ぁ↔あ)으로 골라
 * 「小゛゜」를 누를지 말지, 몇 번 누를지를 매 글자 판단하게 한다.
 */
const comboLevels: Level[] = [
  combo(11, 'dakuten', {
    focus: chars('がぎぐげござじずぜぞだぢづでどばびぶべぼ'),
    review: chars('かきくけこさしすせそたちつてとはひふへほ'),
    words: dakutenWords,
  }),
  combo(12, 'handakuten', {
    focus: chars('ぱぴぷぺぽ'),
    review: chars('ばびぶべぼはひふへほ'),
    words: handakutenWords,
  }),
  combo(13, 'small', {
    focus: chars('ぁぃぅぇぉゃゅょっ'),
    review: chars('あいうえおやゆよつ'),
  }),
  combo(14, 'yoon', {
    focus: YOON,
    words: yoonWords,
    lineLength: 4,
    reviewRatio: 0,
  }),
  // 촉음은 뒤 글자와 이어져야 의미가 있어 단어로만 낸다.
  combo(15, 'sokuon', { focus: [], words: sokuonWords, lineCount: 10, reviewRatio: 0 }),
];

const word = (
  number: number,
  topic: KatakanaTopic,
  words: readonly string[],
  keys: readonly string[] = [],
): Level => ({
  id: `L${number}`,
  number,
  stage: 'katakana',
  kind: 'word',
  keys,
  topic,
  drill: {
    focus: [],
    review: [],
    words,
    lineLength: LINE_LENGTH,
    lineCount: 10,
    reviewRatio: 0,
    judge: 'commit',
  },
});

/**
 * 가타카나 단계 L16–L17. 가타카나 모드가 없으므로 히라가나로 읽기를 친 뒤 후보에서 고른다.
 * 그래서 확정한 결과로 채점한다(commit). 장음 ー는 わ 키 → 라 도해를 보여 준다.
 */
const katakanaLevels: Level[] = [
  word(16, 'katakana', katakanaWords),
  word(17, 'longVowel', longVowelWords, ['わ']),
];

export const levels: readonly Level[] = [
  ...rowLevels,
  {
    id: 'L10',
    number: 10,
    stage: 'basic',
    kind: 'all',
    keys: [],
    assessment: true,
    drill: {
      focus: allKana,
      review: [],
      words: hiraganaWords,
      lineLength: LINE_LENGTH,
      lineCount: 10,
      reviewRatio: 0,
    },
  },
  ...comboLevels,
  ...katakanaLevels,
];

export function findLevel(id: string): Level | undefined {
  return levels.find((level) => level.id === id);
}

/** 다음 레벨. 마지막이면 undefined */
export function nextLevel(id: string): Level | undefined {
  const index = levels.findIndex((level) => level.id === id);
  return index === -1 ? undefined : levels[index + 1];
}
