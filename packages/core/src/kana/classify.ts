import { danOf, keyRowOf } from './rows';
import { isKana, toHiragana } from './script';
import { sameVariantFamily, variantBase } from './variants';

/**
 * 틀린 글자의 종류 (계획 §10.4). 손가락 움직임이 아니라 목표·입력 문자 쌍만으로 추정한다.
 * - dakuten / handakuten / small: 기본 글자는 맞고 변형(゛ ゜ 小)이 다름
 * - direction: 같은 키의 다른 방향 (か→き)
 * - key: 같은 방향(단)의 다른 키 (か→さ)
 * - long-vowel: 장음 ー를 모음으로 쓰거나(コウヒイ) 모음 자리에 ー를 씀
 * - script: 읽기는 맞지만 가타카나로 변환하지 않음 (カ→か)
 * - conversion: 다른 한자로 변환함 (カメラ→亀等)
 * - extra: 목표보다 더 친 글자
 * 가타카나는 히라가나로 바꿔 같은 규칙으로 본다 (カ→キ는 direction).
 */
export type MistakeKind =
  | 'dakuten'
  | 'handakuten'
  | 'small'
  | 'direction'
  | 'key'
  | 'long-vowel'
  | 'script'
  | 'conversion'
  | 'extra'
  | 'other';

const SMALL = new Set(Array.from('ぁぃぅぇぉっゃゅょゎ'));
const HANDAKUTEN = new Set(Array.from('ぱぴぷぺぽ'));
const LONG_VOWEL = '\u{30FC}';
const HAN = /\p{Script=Han}/u;

export function classifyMistake(expected: string, actual: string): MistakeKind {
  if (expected === '') return 'extra';
  if (expected === LONG_VOWEL || actual === LONG_VOWEL) return 'long-vowel';
  const e = toHiragana(expected);
  const a = toHiragana(actual);
  if (e === a) return 'script';
  if (!isKana(actual) && HAN.test(actual)) return 'conversion';
  if (sameVariantFamily(e, a)) {
    if (SMALL.has(e) || SMALL.has(a)) return 'small';
    if (HANDAKUTEN.has(e) || HANDAKUTEN.has(a)) return 'handakuten';
    return 'dakuten';
  }
  const eBase = variantBase(e);
  const aBase = variantBase(a);
  const row = keyRowOf(eBase);
  if (row !== -1 && row === keyRowOf(aBase)) return 'direction';
  const dan = danOf(eBase);
  if (dan !== null && dan === danOf(aBase)) return 'key';
  return 'other';
}
