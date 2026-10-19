/**
 * 탁점·반탁점·소문자 변형으로 서로 바뀔 수 있는 가나 묶음.
 * 키보드와 무관한 문자 관계다. 어떤 키를 몇 번 누르는지는 KeyboardGuide가 가진다.
 */
const FAMILIES: readonly string[] = [
  'あぁ',
  'いぃ',
  'うぅゔ',
  'えぇ',
  'おぉ',
  'かが',
  'きぎ',
  'くぐ',
  'けげ',
  'こご',
  'さざ',
  'しじ',
  'すず',
  'せぜ',
  'そぞ',
  'ただ',
  'ちぢ',
  'つっづ',
  'てで',
  'とど',
  'はばぱ',
  'ひびぴ',
  'ふぶぷ',
  'へべぺ',
  'ほぼぽ',
  'やゃ',
  'ゆゅ',
  'よょ',
  'わゎ',
];

const FAMILY_OF = new Map<string, number>();
FAMILIES.forEach((family, index) => {
  for (const kana of family) FAMILY_OF.set(kana, index);
});

/** 탁점·반탁점·작은 글자를 떼어 낸 기본 가나 (が→か, ぱ→は, っ→つ). 변형이 없으면 그대로 */
export function variantBase(kana: string): string {
  const family = FAMILY_OF.get(kana);
  return family === undefined ? kana : (Array.from(FAMILIES[family] ?? kana)[0] ?? kana);
}

/** 두 가나가 변형 키로 서로 바뀔 수 있으면 true (같은 문자도 true) */
export function sameVariantFamily(a: string, b: string): boolean {
  const family = FAMILY_OF.get(a);
  return family !== undefined && family === FAMILY_OF.get(b);
}
