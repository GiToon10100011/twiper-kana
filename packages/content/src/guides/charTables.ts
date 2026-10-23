/** 글자 찾기(「이 글자 어떻게 쳐요?」)의 표 종류 */
export type CharTableId = 'basic' | 'voiced' | 'small' | 'yoon' | 'symbol';

export interface CharTable {
  id: CharTableId;
  /** 한 줄 = 같은 키(기본) 또는 같은 계열의 글자 */
  rows: readonly (readonly string[])[];
}

const row = (chars: string): string[] => Array.from(chars);
const yoon = (heads: string): string[][] =>
  Array.from(heads, (head) => Array.from('ゃゅょ', (small) => head + small));

/**
 * 글자 찾기 표. 기본 표는 키 하나를 한 줄로 둬서 "같은 키의 글자"가 보이게 한다.
 * 모든 글자는 iosKana로 칠 수 있어야 한다 (content 테스트가 확인한다).
 */
export const charTables: readonly CharTable[] = [
  {
    id: 'basic',
    rows: [
      row('あいうえお'),
      row('かきくけこ'),
      row('さしすせそ'),
      row('たちつてと'),
      row('なにぬねの'),
      row('はひふへほ'),
      row('まみむめも'),
      row('やゆよ'),
      row('らりるれろ'),
      row('わをんー'),
      row('、。？！'),
    ],
  },
  {
    id: 'voiced',
    rows: [
      row('がぎぐげご'),
      row('ざじずぜぞ'),
      row('だぢづでど'),
      row('ばびぶべぼ'),
      row('ぱぴぷぺぽ'),
      row('ゔ'),
    ],
  },
  {
    id: 'small',
    rows: [row('ぁぃぅぇぉ'), row('っ'), row('ゃゅょ'), row('ゎ')],
  },
  { id: 'yoon', rows: yoon('きしちにひみりぎじびぴ') },
  {
    id: 'symbol',
    // 〜(U+301C)·…·々·・·♪·☆는 ☆123 자판에 있다
    rows: [row('「」'), row('\u{301C}…・'), row('々♪☆')],
  },
];
