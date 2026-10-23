import { toHiragana } from '../kana/script';
import { tokenizeKana } from '../kana/tokenize';
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

/**
 * 키로 칠 수 있는 글자를 찾는다. かな 자판(가타카나는 읽기로)에서 먼저 찾고, 없으면 ☆123·ABC 자판에서 찾는다.
 * 어느 자판에도 없으면 null (한자 등)
 */
export function lookupChar(guide: KeyboardGuide, char: string): InputStep[] | null {
  const kana = explainChar(guide, char);
  if (kana) return kana;
  for (const layer of ['number', 'alpha'] as const) {
    const step = findKeyStep(guide, char, layer);
    if (step) return [step];
  }
  return null;
}

/** 글자 찾기에서 한 소리 단위 (きゃ처럼 작은 글자는 앞 글자와 묶는다) */
export interface TextPart {
  text: string;
  /** 글자마다 치는 동작. 키로 칠 수 없는 글자는 null */
  chars: { char: string; steps: InputStep[] | null }[];
  /** 가타카나라서 읽기를 친 뒤 후보에서 골라야 한다 */
  convert: boolean;
}

/** 문자열을 소리 단위로 나눠 각 글자를 치는 동작을 붙인다. 공백은 건너뛴다 */
export function explainText(guide: KeyboardGuide, text: string): TextPart[] {
  return tokenizeKana(text.replace(/\s/gu, '')).map((unit) => ({
    text: unit,
    chars: Array.from(unit, (char) => ({ char, steps: lookupChar(guide, char) })),
    convert: toHiragana(unit) !== unit,
  }));
}
