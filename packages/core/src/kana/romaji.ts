import { toHiragana } from './script';

/** 헤본식 로마자. 가나 한 글자 (탁음·반탁음·ゔ 포함) */
const BASE: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      ['あいうえお', ['a', 'i', 'u', 'e', 'o']],
      ['かきくけこ', ['ka', 'ki', 'ku', 'ke', 'ko']],
      ['がぎぐげご', ['ga', 'gi', 'gu', 'ge', 'go']],
      ['さしすせそ', ['sa', 'shi', 'su', 'se', 'so']],
      ['ざじずぜぞ', ['za', 'ji', 'zu', 'ze', 'zo']],
      ['たちつてと', ['ta', 'chi', 'tsu', 'te', 'to']],
      ['だぢづでど', ['da', 'ji', 'zu', 'de', 'do']],
      ['なにぬねの', ['na', 'ni', 'nu', 'ne', 'no']],
      ['はひふへほ', ['ha', 'hi', 'fu', 'he', 'ho']],
      ['ばびぶべぼ', ['ba', 'bi', 'bu', 'be', 'bo']],
      ['ぱぴぷぺぽ', ['pa', 'pi', 'pu', 'pe', 'po']],
      ['まみむめも', ['ma', 'mi', 'mu', 'me', 'mo']],
      ['やゆよ', ['ya', 'yu', 'yo']],
      ['らりるれろ', ['ra', 'ri', 'ru', 're', 'ro']],
      ['わをゔ', ['wa', 'o', 'vu']],
      // 앞 글자 없이 혼자 쓴 작은 글자
      ['ぁぃぅぇぉゃゅょゎ', ['a', 'i', 'u', 'e', 'o', 'ya', 'yu', 'yo', 'wa']],
    ] as const
  ).flatMap(([kana, romaji]) => Array.from(kana, (char, i) => [char, romaji[i] ?? ''])),
);

const SMALL_VOWEL: Readonly<Record<string, string>> = {
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
};
const SMALL_Y: Readonly<Record<string, string>> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const VOWELS = 'aiueo';

/** 앞 글자에 붙는 작은 글자 (그 자체로는 묶음의 머리가 되지 않는다) */
const isSmall = (char: string) => SMALL_Y[char] !== undefined || SMALL_VOWEL[char] !== undefined;

/** 끝 모음을 뗀 자음 부분 (shi → sh, ki → k) */
const stem = (romaji: string) => (VOWELS.includes(romaji.slice(-1)) ? romaji.slice(0, -1) : romaji);

/**
 * 가나를 헤본식 로마자로 바꾼다 (WPM 참고 값의 길이를 세려고 쓴다, 계획 §12).
 * 가타카나는 히라가나로 보고, 요음(きゃ kya, しゃ sha)·외래음(ティ ti, ファ fa, ウィ wi)·촉음(っか kka, っち tchi)을 묶는다.
 * ん은 모음·や행 앞에서 n'로, 장음 ー는 -로 쓴다. 가나가 아닌 글자(영문자·숫자·기호)는 그대로 둔다
 */
export function toRomaji(text: string): string {
  const chars = Array.from(toHiragana(text));
  // 소리 단위로 바꾼 뒤, っ는 다음 소리를 보고 정한다 (아래)
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i] ?? '';
    const next = chars[i + 1] ?? '';
    const base = BASE[char];
    if (base !== undefined && !isSmall(char) && SMALL_Y[next] !== undefined) {
      const head = stem(base);
      // し·ち·じ는 y 없이 (sha cha ja)
      parts.push(
        head.endsWith('h') || head === 'j' ? head + SMALL_Y[next] : `${head}y${SMALL_Y[next]}`,
      );
      i += 1;
    } else if (base !== undefined && !isSmall(char) && SMALL_VOWEL[next] !== undefined) {
      // う + 작은 모음은 w (ウィ wi), 나머지는 자음 + 작은 모음 (ティ ti, ファ fa, シェ she)
      parts.push((char === 'う' ? 'w' : stem(base)) + SMALL_VOWEL[next]);
      i += 1;
    } else if (char === 'ん') {
      // 뒤가 모음·や행이면 n'로 끊는다 (빈 문자열은 includes가 true라 뒤 글자가 있을 때만 본다)
      const after = next === '' ? '' : toRomaji(next).charAt(0);
      parts.push(after !== '' && (VOWELS.includes(after) || after === 'y') ? "n'" : 'n');
    } else if (char === 'ー') {
      parts.push('-');
    } else {
      parts.push(base ?? char);
    }
  }
  // っ는 다음 소리의 첫 자음을 겹친다 (ち 앞은 t). 뒤에 자음이 없으면 tsu
  return parts
    .map((part, i) => {
      if (part !== 'っ') return part;
      const following = parts[i + 1] ?? '';
      if (following.startsWith('ch')) return 't';
      return following && !VOWELS.includes(following.charAt(0)) && /^[a-z]/u.test(following)
        ? following.charAt(0)
        : 'tsu';
    })
    .join('');
}

/** 영문 타자 기준 WPM: 로마자 글자 수를 5글자 = 1단어로 센다. 시간이 없으면 null */
export function wordsPerMinute(text: string, ms: number): number | null {
  return ms > 0 ? toRomaji(text).length / 5 / (ms / 60_000) : null;
}
