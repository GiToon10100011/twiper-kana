import type { DrillSpec } from '@twiper/core';
import { hiraganaWords } from '../words/hiragana';

export interface Level {
  /** URL과 저장에 쓰는 id */
  readonly id: string;
  readonly number: number;
  /** row: 행별 연습 / all: 50음 전체 */
  readonly kind: 'row' | 'all';
  /** 이 레벨이 다루는 키 (행의 첫 글자). 화면 제목에 쓴다 */
  readonly keys: readonly string[];
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

const rowLevels: Level[] = ROWS.map((row, i) => ({
  id: `L${i + 1}`,
  number: i + 1,
  kind: 'row',
  keys: Array.from(row.keys),
  drill: {
    focus: Array.from(row.kana),
    review: ROWS.slice(0, i).flatMap((prev) => Array.from(prev.kana)),
    lineLength: LINE_LENGTH,
    lineCount: LINE_COUNT,
    reviewRatio: REVIEW_RATIO,
  },
}));

const allKana = ROWS.flatMap((row) => Array.from(row.kana));

export const levels: readonly Level[] = [
  ...rowLevels,
  {
    id: 'L10',
    number: 10,
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
];

export function findLevel(id: string): Level | undefined {
  return levels.find((level) => level.id === id);
}

/** 다음 레벨. 마지막이면 undefined */
export function nextLevel(id: string): Level | undefined {
  const index = levels.findIndex((level) => level.id === id);
  return index === -1 ? undefined : levels[index + 1];
}
