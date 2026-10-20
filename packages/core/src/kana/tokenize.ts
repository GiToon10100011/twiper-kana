/** 앞 글자와 붙어 한 소리가 되는 작은 글자 (요음 きゃ·シャ, 외래음 てぃ·ティ) */
const ATTACHING_SMALL = new Set(Array.from('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ'));

/**
 * 가나 문자열을 입력 규칙 단위로 자른다 (계획 §10.1의 기본형).
 * 요음·작은 모음은 앞 글자와 한 단위로 묶고, 촉음 っ·ッ, 장음 ー와 나머지는 한 글자씩 둔다.
 */
export function tokenizeKana(text: string): string[] {
  const units: string[] = [];
  for (const char of text) {
    const last = units.length - 1;
    if (ATTACHING_SMALL.has(char) && last >= 0) units[last] += char;
    else units.push(char);
  }
  return units;
}
