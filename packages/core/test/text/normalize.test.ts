import { describe, expect, it } from 'vitest';
import { normalizeBase, normalizeForCompare } from '../../src/index';

describe('normalizeBase', () => {
  it('결합 탁점을 합성형으로 바꾼다 (NFC)', () => {
    expect(normalizeBase('か\u{3099}')).toBe('が');
  });

  it('전각 물결표를 물결 대시로 통일한다', () => {
    expect(normalizeBase('\u{FF5E}')).toBe('\u{301C}');
  });

  it('제로폭 문자를 제거한다', () => {
    expect(normalizeBase('あ\u{200B}い\u{FEFF}')).toBe('あい');
  });

  it('장음 기호·하이픈·전각/반각·가나 종류는 건드리지 않는다', () => {
    expect(normalizeBase('ー')).toBe('ー');
    expect(normalizeBase('-')).toBe('-');
    expect(normalizeBase('！')).toBe('！');
    expect(normalizeBase('ｶ')).toBe('ｶ');
    expect(normalizeBase('カ')).toBe('カ');
  });
});

describe('normalizeForCompare', () => {
  it('앞뒤 공백과 줄바꿈을 제거한다', () => {
    expect(normalizeForCompare(' こんにちは\n')).toBe('こんにちは');
  });
});
