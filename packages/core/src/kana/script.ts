// 가타카나 ァ(U+30A1)–ヶ(U+30F6)와 히라가나 ぁ(U+3041)–ゖ(U+3096)는 code point가 0x60씩 차이 나며 1:1로 대응한다.
const HIRAGANA_FIRST = 0x3041;
const HIRAGANA_LAST = 0x3096;
const KATAKANA_FIRST = 0x30a1;
const KATAKANA_LAST = 0x30f6;
const OFFSET = KATAKANA_FIRST - HIRAGANA_FIRST;

// 히라가나 ぁ–ゖ, 가타카나 ァ–ヺ, 장음 ー(U+30FC)
const KANA = /^[\u{3041}-\u{3096}\u{30A1}-\u{30FA}\u{30FC}]$/u;

function shift(text: string, first: number, last: number, delta: number): string {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? 0;
    return code >= first && code <= last ? String.fromCodePoint(code + delta) : char;
  }).join('');
}

/** 가타카나를 히라가나로 바꾼다 (カメラ → かめら). 장음 ー와 가나가 아닌 문자는 그대로 */
export function toHiragana(text: string): string {
  return shift(text, KATAKANA_FIRST, KATAKANA_LAST, -OFFSET);
}

/** 히라가나를 가타카나로 바꾼다 (かめら → カメラ) */
export function toKatakana(text: string): string {
  return shift(text, HIRAGANA_FIRST, HIRAGANA_LAST, OFFSET);
}

/** 가나 한 글자(히라가나·가타카나·장음 ー)면 true */
export function isKana(char: string): boolean {
  return KANA.test(char);
}
