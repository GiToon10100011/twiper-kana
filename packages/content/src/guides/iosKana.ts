import type { FlickDirection, GuideKey, KeyboardGuide } from '@twiper/core';

type Outputs = GuideKey['outputs'];

const key = (
  id: string,
  label: string,
  row: number,
  col: number,
  outputs: Outputs,
  unverified: readonly FlickDirection[] = [],
): GuideKey => ({ id, label, row, col, outputs, unverified });

/** 탭·←·↑·→·↓ 순서로 적은 글자들을 outputs로 바꾼다. */
const flicks = (chars: string): Outputs => {
  const [tap, left, up, right, down] = Array.from(chars);
  return { tap, left, up, right, down };
};

/** 기본 문자와 변형을 같은 순서로 적어 변형 계열을 만든다: cycles('かき', 'がぎ') → か/が, き/ぎ */
const cycles = (...rows: string[]): { chars: string[] }[] => {
  const columns = rows.map((row) => Array.from(row));
  return (columns[0] ?? []).map((_, i) => ({ chars: columns.map((column) => column[i] ?? '') }));
};

// 눈으로 구분하기 어려운 문자는 code point로 적는다.
const WAVE_DASH = '\u{301C}';
const BACKSLASH = '\u{5C}';
const FULLWIDTH_ASTERISK = '\u{FF0A}';

/**
 * iPhone 기본 「日本語 - かな」 키보드.
 *
 * 2026-10-17 iPhone(iOS 18.7)에서 /lab/guide-check로 확인했다.
 * 기록: test/fixtures/ios-kana-guide-check-2026-10-17.json
 * - 小゛゜ 키는 플릭하지 않고, 탭할 때마다 변형을 순환한다 (사용자 관찰)
 * - 숫자 모드에서 4 키 ↑만 전각 ＊를 내고, 나머지 영숫자 기호는 반각이다
 *
 * 새로 추가하는 항목은 실기기로 다시 확인하기 전까지 unverified로 표시한다.
 */
export const iosKana: KeyboardGuide = {
  id: 'ios-kana',
  name: 'iPhone かな',
  layers: {
    kana: {
      switchLabel: 'あいう',
      keys: [
        key('a', 'あ', 0, 0, flicks('あいうえお')),
        key('ka', 'か', 0, 1, flicks('かきくけこ')),
        key('sa', 'さ', 0, 2, flicks('さしすせそ')),
        key('ta', 'た', 1, 0, flicks('たちつてと')),
        key('na', 'な', 1, 1, flicks('なにぬねの')),
        key('ha', 'は', 1, 2, flicks('はひふへほ')),
        key('ma', 'ま', 2, 0, flicks('まみむめも')),
        key('ya', 'や', 2, 1, { tap: 'や', left: '「', up: 'ゆ', right: '」', down: 'よ' }),
        key('ra', 'ら', 2, 2, flicks('らりるれろ')),
        key('wa', 'わ', 3, 1, { tap: 'わ', left: 'を', up: 'ん', right: 'ー' }),
        key('punct', '、。?!', 3, 2, { tap: '、', left: '。', up: '？', right: '！' }),
      ],
    },
    number: {
      switchLabel: '☆123',
      keys: [
        key('1', '1', 0, 0, { tap: '1', left: '☆', up: '♪', right: '→' }),
        key('2', '2', 0, 1, { tap: '2', left: '¥', up: '$', right: '€' }),
        key('3', '3', 0, 2, { tap: '3', left: '%', up: '°', right: '#' }),
        key('4', '4', 1, 0, { tap: '4', left: '○', up: FULLWIDTH_ASTERISK, right: '・' }),
        key('5', '5', 1, 1, { tap: '5', left: '+', up: '×', right: '÷' }),
        key('6', '6', 1, 2, { tap: '6', left: '<', up: '=', right: '>' }),
        key('7', '7', 2, 0, { tap: '7', left: '「', up: '」', right: ':' }),
        key('8', '8', 2, 1, { tap: '8', left: '〒', up: '々', right: '〆' }),
        key('9', '9', 2, 2, { tap: '9', left: '^', up: '|', right: BACKSLASH }),
        key('paren', '()[]', 3, 0, { tap: '(', left: ')', up: '[', right: ']' }),
        key('0', '0', 3, 1, { tap: '0', left: WAVE_DASH, up: '…' }),
        key('dot', '.,-/', 3, 2, { tap: '.', left: ',', up: '-', right: '/' }),
      ],
    },
    alpha: {
      switchLabel: 'ABC',
      keys: [
        key('sym', '@#/&_', 0, 0, { tap: '@', left: '#', up: '/', right: '&', down: '_' }),
        key('abc', 'ABC', 0, 1, flicks('abc')),
        key('def', 'DEF', 0, 2, flicks('def')),
        key('ghi', 'GHI', 1, 0, flicks('ghi')),
        key('jkl', 'JKL', 1, 1, flicks('jkl')),
        key('mno', 'MNO', 1, 2, flicks('mno')),
        key('pqrs', 'PQRS', 2, 0, flicks('pqrs')),
        key('tuv', 'TUV', 2, 1, flicks('tuv')),
        key('wxyz', 'WXYZ', 2, 2, flicks('wxyz')),
        key('quote', `'"()`, 3, 1, { tap: "'", left: '"', up: '(', right: ')' }),
        key('dot', '.,?!', 3, 2, { tap: '.', left: ',', up: '?', right: '!' }),
      ],
    },
  },
  modifier: {
    label: '小゛゜',
    row: 3,
    col: 0,
    cycles: [
      ...cycles('あいえお', 'ぁぃぇぉ'),
      { chars: ['う', 'ぅ', 'ゔ'] },
      ...cycles('かきくけこ', 'がぎぐげご'),
      ...cycles('さしすせそ', 'ざじずぜぞ'),
      ...cycles('たちてと', 'だぢでど'),
      { chars: ['つ', 'っ', 'づ'] },
      ...cycles('はひふへほ', 'ばびぶべぼ', 'ぱぴぷぺぽ'),
      ...cycles('やゆよ', 'ゃゅょ'),
      { chars: ['わ', 'ゎ'] },
    ],
    direct: [],
  },
};
