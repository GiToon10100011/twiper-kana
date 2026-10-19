import type { DrillSpec } from '@twiper/core';
import { dakutenWords, handakutenWords, sokuonWords, yoonWords } from '../words/combos';
import { hiraganaWords } from '../words/hiragana';

/** 조합 단계에서 다루는 규칙. 모두 「小゛゜」 키로 만든다 */
export type ComboTopic = 'dakuten' | 'handakuten' | 'small' | 'yoon' | 'sokuon';

export interface Level {
  /** URL과 저장에 쓰는 id */
  readonly id: string;
  readonly number: number;
  /** basic: 기초(50음) / combo: 문자 조합 (계획 §10.2) */
  readonly stage: 'basic' | 'combo';
  /** row: 행별 연습 / all: 50음 전체 / combo: 조합 규칙 하나 */
  readonly kind: 'row' | 'all' | 'combo';
  /** 이 레벨이 다루는 키 (행의 첫 글자). 행별 레벨의 제목·도해에 쓴다 */
  readonly keys: readonly string[];
  /** 조합 레벨의 규칙 */
  readonly topic?: ComboTopic;
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

export const levels: readonly Level[] = [
  ...rowLevels,
  {
    id: 'L10',
    number: 10,
    stage: 'basic',
    kind: 'all',
    keys: [],
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
];

export function findLevel(id: string): Level | undefined {
  return levels.find((level) => level.id === id);
}

/** 다음 레벨. 마지막이면 undefined */
export function nextLevel(id: string): Level | undefined {
  const index = levels.findIndex((level) => level.id === id);
  return index === -1 ? undefined : levels[index + 1];
}
