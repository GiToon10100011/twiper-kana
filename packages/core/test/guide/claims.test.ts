import { describe, expect, it } from 'vitest';
import { findKeyStep, guideClaims, type KeyboardGuide } from '../../src/index';

const guide: KeyboardGuide = {
  id: 'test',
  name: '테스트 가이드',
  layers: {
    kana: {
      switchLabel: 'あいう',
      keys: [
        {
          id: 'ha',
          label: 'は',
          row: 1,
          col: 2,
          outputs: { tap: 'は', left: 'ひ' },
        },
        {
          id: 'ya',
          label: 'や',
          row: 2,
          col: 1,
          outputs: { tap: 'や', left: '「' },
          unverified: ['left'],
        },
      ],
    },
    number: {
      switchLabel: '☆123',
      keys: [{ id: '1', label: '1', row: 0, col: 0, outputs: { tap: '1' } }],
    },
    alpha: { switchLabel: 'ABC', keys: [] },
  },
  modifier: {
    label: '小゛゜',
    row: 3,
    col: 0,
    cycles: [{ chars: ['は', 'ば', 'ぱ'] }, { chars: ['や', 'ゃ'], unverified: true }],
    direct: [{ dir: 'right', base: 'は', out: 'ぱ' }],
  },
};

describe('findKeyStep', () => {
  it('문자를 내는 키와 방향을 찾는다', () => {
    expect(findKeyStep(guide, 'ひ')).toEqual({
      kind: 'key',
      layer: 'kana',
      keyId: 'ha',
      label: 'は',
      dir: 'left',
      out: 'ひ',
    });
  });

  it('없는 문자는 null', () => {
    expect(findKeyStep(guide, 'ん')).toBeNull();
    expect(findKeyStep(guide, '1')).toBeNull();
    expect(findKeyStep(guide, '1', 'number')?.keyId).toBe('1');
  });
});

describe('guideClaims', () => {
  const claims = guideClaims(guide);
  const byId = new Map(claims.map((claim) => [claim.id, claim]));

  it('출력이 있는 키·방향마다 주장 한 건을 만든다', () => {
    expect(claims.filter((claim) => claim.steps.length === 1).map((claim) => claim.id)).toEqual([
      'kana.ha.tap',
      'kana.ha.left',
      'kana.ya.tap',
      'kana.ya.left',
      'number.1.tap',
    ]);
    expect(byId.get('kana.ha.left')?.expected).toBe('ひ');
  });

  it('실기 확인이 필요한 방향만 unverified로 표시한다', () => {
    expect(byId.get('kana.ya.left')?.unverified).toBe(true);
    expect(byId.get('kana.ya.tap')?.unverified).toBe(false);
  });

  it('변형 순환은 기본 문자를 입력한 뒤 변형 키를 n번 누르는 동작으로 푼다', () => {
    const handakuten = byId.get('modifier.cycle.は.2');

    expect(handakuten?.expected).toBe('ぱ');
    expect(handakuten?.steps).toEqual([
      { kind: 'key', layer: 'kana', keyId: 'ha', label: 'は', dir: 'tap', out: 'は' },
      { kind: 'modifier', dir: 'tap', times: 2, out: 'ぱ' },
    ]);
    expect(byId.get('modifier.cycle.は.1')?.unverified).toBe(false);
    expect(byId.get('modifier.cycle.や.1')?.unverified).toBe(true);
  });

  it('변형 키 플릭은 항상 실기 확인 대상이다', () => {
    const direct = byId.get('modifier.direct.right');

    expect(direct?.expected).toBe('ぱ');
    expect(direct?.unverified).toBe(true);
    expect(direct?.steps[1]).toEqual({ kind: 'modifier', dir: 'right', times: 1, out: 'ぱ' });
  });

  it('기본 문자를 낼 키가 없으면 데이터 오류로 본다', () => {
    const broken: KeyboardGuide = {
      ...guide,
      modifier: { ...guide.modifier, cycles: [{ chars: ['つ', 'っ'] }] },
    };

    expect(() => guideClaims(broken)).toThrow(/つ/);
  });
});
