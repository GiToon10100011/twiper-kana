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

/** 서로 다른 두 가나가 같은 키에 있으면 true */
export function sameKeyRow(a: string, b: string): boolean {
  const row = keyRowOf(a);
  return a !== b && row !== -1 && row === keyRowOf(b);
}
