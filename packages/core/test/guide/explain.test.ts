import { describe, expect, it } from 'vitest';
import { explainChar, explainText, lookupChar, type KeyboardGuide } from '../../src/index';

const guide: KeyboardGuide = {
  id: 'test',
  name: '테스트 가이드',
  layers: {
    kana: {
      switchLabel: 'あいう',
      keys: [
        { id: 'ka', label: 'か', row: 0, col: 1, outputs: { tap: 'か', left: 'き' } },
        { id: 'ha', label: 'は', row: 1, col: 2, outputs: { tap: 'は', right: 'へ' } },
        { id: 'ya', label: 'や', row: 2, col: 1, outputs: { tap: 'や' } },
        { id: 'wa', label: 'わ', row: 3, col: 1, outputs: { tap: 'わ', right: 'ー' } },
      ],
    },
    number: { switchLabel: '☆123', keys: [] },
    alpha: { switchLabel: 'ABC', keys: [] },
  },
  modifier: {
    label: '小゛゜',
    row: 3,
    col: 0,
    cycles: [
      { chars: ['き', 'ぎ'] },
      { chars: ['へ', 'べ', 'ぺ'] },
      { chars: ['や', 'ゃ'] },
      // 기본 문자를 내는 키가 없는 계열
      { chars: ['つ', 'っ'] },
    ],
    direct: [],
  },
};

describe('explainChar', () => {
  it('키에 있는 글자는 그 키의 탭·플릭 한 번이다', () => {
    expect(explainChar(guide, 'き')).toEqual([
      { kind: 'key', layer: 'kana', keyId: 'ka', label: 'か', dir: 'left', out: 'き' },
    ]);
    expect(explainChar(guide, 'ー')).toEqual([
      { kind: 'key', layer: 'kana', keyId: 'wa', label: 'わ', dir: 'right', out: 'ー' },
    ]);
  });

  it('변형 글자는 기본 글자를 친 뒤 「小゛゜」를 순환 위치만큼 누른다', () => {
    expect(explainChar(guide, 'ぎ')).toEqual([
      { kind: 'key', layer: 'kana', keyId: 'ka', label: 'か', dir: 'left', out: 'き' },
      { kind: 'modifier', dir: 'tap', times: 1, out: 'ぎ' },
    ]);
    expect(explainChar(guide, 'ぺ')?.[1]).toEqual({
      kind: 'modifier',
      dir: 'tap',
      times: 2,
      out: 'ぺ',
    });
  });

  it('가타카나는 읽기(히라가나)를 치는 동작으로 풀어 준다', () => {
    expect(explainChar(guide, 'ベ')).toEqual(explainChar(guide, 'べ'));
    expect(explainChar(guide, 'ャ')).toEqual([
      { kind: 'key', layer: 'kana', keyId: 'ya', label: 'や', dir: 'tap', out: 'や' },
      { kind: 'modifier', dir: 'tap', times: 1, out: 'ゃ' },
    ]);
  });

  it('가이드로 칠 수 없는 글자는 null이다', () => {
    expect(explainChar(guide, '亀')).toBeNull();
    expect(explainChar(guide, 'っ')).toBeNull();
    expect(explainChar(guide, '')).toBeNull();
  });
});

/** ☆123·ABC 자판에도 키가 있는 가이드. 「는 かな(や ←)와 ☆123(7 ←) 양쪽에 있다 */
const withLayers: KeyboardGuide = {
  ...guide,
  layers: {
    kana: {
      ...guide.layers.kana,
      keys: [
        ...guide.layers.kana.keys.filter((key) => key.id !== 'ya'),
        { id: 'ya', label: 'や', row: 2, col: 1, outputs: { tap: 'や', left: '「' } },
      ],
    },
    number: {
      switchLabel: '☆123',
      keys: [
        { id: '7', label: '7', row: 2, col: 0, outputs: { tap: '7', left: '「' } },
        { id: '8', label: '8', row: 2, col: 1, outputs: { tap: '8', up: '々' } },
      ],
    },
    alpha: {
      switchLabel: 'ABC',
      keys: [{ id: 'wxyz', label: 'WXYZ', row: 2, col: 2, outputs: { tap: 'w', left: 'x' } }],
    },
  },
};

describe('lookupChar', () => {
  it('かな 자판에 있으면 explainChar와 같다', () => {
    expect(lookupChar(withLayers, 'ぎ')).toEqual(explainChar(withLayers, 'ぎ'));
    expect(lookupChar(withLayers, '「')?.[0]).toMatchObject({ layer: 'kana', keyId: 'ya' });
  });

  it('かな 자판에 없으면 ☆123, ABC 자판 순서로 찾는다', () => {
    expect(lookupChar(withLayers, '々')).toEqual([
      { kind: 'key', layer: 'number', keyId: '8', label: '8', dir: 'up', out: '々' },
    ]);
    expect(lookupChar(withLayers, 'x')).toEqual([
      { kind: 'key', layer: 'alpha', keyId: 'wxyz', label: 'WXYZ', dir: 'left', out: 'x' },
    ]);
  });

  it('어느 자판에도 없으면 null이다', () => {
    expect(lookupChar(withLayers, '亀')).toBeNull();
    expect(lookupChar(withLayers, 'X')).toBeNull();
  });
});

describe('explainText', () => {
  it('작은 글자는 앞 글자와 한 단위로 묶고, 글자마다 치는 동작을 붙인다', () => {
    const parts = explainText(guide, 'きゃー');
    expect(parts.map((part) => part.text)).toEqual(['きゃ', 'ー']);
    expect(parts[0]?.chars.map((c) => c.steps?.at(-1)?.out)).toEqual(['き', 'ゃ']);
    expect(parts.every((part) => !part.convert)).toBe(true);
  });

  it('가타카나 단위는 변환이 필요하다고 표시한다', () => {
    const parts = explainText(guide, 'キャー');
    expect(parts.map((part) => [part.text, part.convert])).toEqual([
      ['キャ', true],
      ['ー', false],
    ]);
    expect(parts[0]?.chars[1]?.steps).toEqual(explainChar(guide, 'ゃ'));
  });

  it('공백은 건너뛰고, 칠 수 없는 글자는 동작이 null이다', () => {
    const parts = explainText(guide, ' 亀 き\n');
    expect(parts.map((part) => part.text)).toEqual(['亀', 'き']);
    expect(parts[0]?.chars[0]?.steps).toBeNull();
    expect(explainText(guide, '  ')).toEqual([]);
  });
});
