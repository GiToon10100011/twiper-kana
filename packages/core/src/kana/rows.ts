/** 12키 かな 키보드에서 같은 키에 배정된 가나 묶음. 방향 정보는 KeyboardGuide가 가진다. */
export const KANA_KEY_ROWS: readonly (readonly string[])[] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', 'ゆ', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', 'を', 'ん', 'ー'],
];

const ROW_OF = new Map<string, number>();
KANA_KEY_ROWS.forEach((row, index) => {
  for (const kana of row) ROW_OF.set(kana, index);
});

/** 가나가 속한 키의 번호. 기본 가나가 아니면 -1 */
export function keyRowOf(kana: string): number {
  return ROW_OF.get(kana) ?? -1;
}

export type Dan = 'a' | 'i' | 'u' | 'e' | 'o';

/** 단(모음)별 기본 가나. を·ん·ー는 방향과 모음이 맞지 않아 넣지 않는다 */
const DAN_KANA: Record<Dan, string> = {
  a: 'あかさたなはまやらわ',
  i: 'いきしちにひみり',
  u: 'うくすつぬふむゆる',
  e: 'えけせてねへめれ',
  o: 'おこそとのほもよろ',
};

const DAN_OF = new Map<string, Dan>();
for (const [dan, kana] of Object.entries(DAN_KANA) as [Dan, string][]) {
  for (const char of kana) DAN_OF.set(char, dan);
}

/** 기본 가나의 단. 탁음·작은 글자 등은 먼저 variantBase로 기본 가나로 바꿔서 넘긴다 */
export function danOf(kana: string): Dan | null {
  return DAN_OF.get(kana) ?? null;
}

/** 서로 다른 두 가나가 같은 키에 있으면 true */
export function sameKeyRow(a: string, b: string): boolean {
  const row = keyRowOf(a);
  return a !== b && row !== -1 && row === keyRowOf(b);
}
