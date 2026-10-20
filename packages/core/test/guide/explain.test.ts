import { describe, expect, it } from 'vitest';
import { explainChar, type KeyboardGuide } from '../../src/index';

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
