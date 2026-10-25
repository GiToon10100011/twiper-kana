/** 앞 글자와 붙어 한 소리가 되는 작은 글자 (요음 きゃ·シャ, 외래음 てぃ·ティ) */
const ATTACHING_SMALL = new Set(Array.from('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ'));

/** 한자 표기 `{時々|ときどき}`. 읽기를 붙인 표기는 통째로 한 단위다 */
const RUBY_UNIT = /(\{[^{}|]+\|[^{}|]+\})/u;

/**
 * 가나 문자열을 입력 규칙 단위로 자른다 (계획 §10.1의 기본형).
 * 요음·작은 모음은 앞 글자와 한 단위로 묶고, 촉음 っ·ッ, 장음 ー와 나머지는 한 글자씩 둔다.
 * 한자 표기 `{時々|ときどき}`는 표기째 한 단위로 둔다.
 */
export function tokenizeKana(text: string): string[] {
  const units: string[] = [];
  let afterRuby = false;
  for (const part of text.split(RUBY_UNIT)) {
    if (RUBY_UNIT.test(part)) {
      units.push(part);
      afterRuby = true;
      continue;
    }
    for (const char of part) {
      const last = units.length - 1;
      if (ATTACHING_SMALL.has(char) && last >= 0 && !afterRuby) units[last] += char;
      else units.push(char);
      afterRuby = false;
    }
  }
  return units;
}
