import { describe, expect, it } from 'vitest';
import { sameVariantFamily } from '../../src/index';

describe('sameVariantFamily', () => {
  it('탁점·반탁점·소문자 변형은 같은 묶음이다', () => {
    expect(sameVariantFamily('か', 'が')).toBe(true);
    expect(sameVariantFamily('ば', 'ぱ')).toBe(true);
    expect(sameVariantFamily('つ', 'づ')).toBe(true);
    expect(sameVariantFamily('っ', 'づ')).toBe(true);
    expect(sameVariantFamily('ゃ', 'や')).toBe(true);
    expect(sameVariantFamily('ぅ', 'ゔ')).toBe(true);
  });

  it('같은 키의 다른 글자나 변형이 없는 글자는 다른 묶음이다', () => {
    expect(sameVariantFamily('あ', 'い')).toBe(false);
    expect(sameVariantFamily('か', 'さ')).toBe(false);
    expect(sameVariantFamily('な', 'な')).toBe(false);
    expect(sameVariantFamily('ー', 'ー')).toBe(false);
  });
});
