import { danOf, keyRowOf } from './rows';
import { sameVariantFamily, variantBase } from './variants';

/**
 * 틀린 글자의 종류 (계획 §10.4). 손가락 움직임이 아니라 목표·입력 문자 쌍만으로 추정한다.
 * - dakuten / handakuten / small: 기본 글자는 맞고 변형(゛ ゜ 小)이 다름
 * - direction: 같은 키의 다른 방향 (か→き)
 * - key: 같은 방향(단)의 다른 키 (か→さ)
 * - extra: 목표보다 더 친 글자
 */
export type MistakeKind =
  'dakuten' | 'handakuten' | 'small' | 'direction' | 'key' | 'extra' | 'other';

const SMALL = new Set(Array.from('ぁぃぅぇぉっゃゅょゎ'));
const HANDAKUTEN = new Set(Array.from('ぱぴぷぺぽ'));

export function classifyMistake(expected: string, actual: string): MistakeKind {
  if (expected === '') return 'extra';
  if (expected !== actual && sameVariantFamily(expected, actual)) {
    if (SMALL.has(expected) || SMALL.has(actual)) return 'small';
    if (HANDAKUTEN.has(expected) || HANDAKUTEN.has(actual)) return 'handakuten';
    return 'dakuten';
  }
  const e = variantBase(expected);
  const a = variantBase(actual);
  const row = keyRowOf(e);
  if (row !== -1 && row === keyRowOf(a)) return 'direction';
  const dan = danOf(e);
  if (dan !== null && dan === danOf(a)) return 'key';
  return 'other';
}
