import { toHiragana } from '../kana/script';
import { findKeyStep } from './claims';
import type { InputStep, KeyboardGuide } from './types';

/**
 * 가나 한 글자를 치는 동작. 키를 탭·플릭하고, 변형 글자면 이어서 「小゛゜」를 순환 위치만큼 누른다.
 * 가타카나는 읽기(히라가나)를 치는 동작으로 풀어 준다. 변환은 단어를 다 친 뒤 따로 안내한다.
 * 가이드로 칠 수 없는 글자면 null
 */
export function explainChar(guide: KeyboardGuide, char: string): InputStep[] | null {
  if (char === '') return null;
  const reading = toHiragana(char);
  const direct = findKeyStep(guide, reading);
  if (direct) return [direct];

  for (const cycle of guide.modifier.cycles) {
    const times = cycle.chars.indexOf(reading);
    const base = cycle.chars[0];
    if (times < 1 || base === undefined) continue;
    const baseStep = findKeyStep(guide, base);
    if (!baseStep) return null;
    return [baseStep, { kind: 'modifier', dir: 'tap', times, out: reading }];
  }
  return null;
}
