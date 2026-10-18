import { describe, expect, it } from 'vitest';
import { classifyMistake, danOf, tokenizeKana, variantBase } from '../../src/index';

describe('variantBase', () => {
  it('탁점·반탁점·작은 글자를 떼어 낸 기본 가나', () => {
    expect(['が', 'ぱ', 'ば', 'っ', 'づ', 'ゃ', 'ぁ', 'か'].map(variantBase)).toEqual([
      'か',
      'は',
      'は',
      'つ',
      'つ',
      'や',
      'あ',
      'か',
    ]);
  });

  it('변형이 없는 문자는 그대로', () => {
    expect(variantBase('ん')).toBe('ん');
    expect(variantBase('k')).toBe('k');
  });
});

describe('danOf', () => {
  it('기본 가나의 단(모음)', () => {
    expect(['か', 'き', 'す', 'て', 'の', 'ゆ', 'よ'].map(danOf)).toEqual([
      'a',
      'i',
      'u',
      'e',
      'o',
      'u',
      'o',
    ]);
  });

  it('단이 없는 문자는 null', () => {
    expect(danOf('ん')).toBeNull();
    expect(danOf('ー')).toBeNull();
    expect(danOf('が')).toBeNull();
  });
});

describe('classifyMistake', () => {
  it.each([
    ['が', 'か', 'dakuten'],
    ['か', 'が', 'dakuten'],
    ['ぱ', 'ば', 'handakuten'],
    ['ぱ', 'は', 'handakuten'],
    ['っ', 'つ', 'small'],
    ['ゃ', 'や', 'small'],
    ['づ', 'っ', 'small'],
    ['え', 'う', 'direction'],
    ['ぎ', 'げ', 'direction'],
    ['か', 'さ', 'key'],
    ['ぎ', 'し', 'key'],
    ['か', 'ね', 'other'],
    ['', 'く', 'extra'],
    ['か', 'k', 'other'],
  ] as const)('目標 %s · 入力 %s → %s', (expected, actual, kind) => {
    expect(classifyMistake(expected, actual)).toBe(kind);
  });
});

describe('tokenizeKana', () => {
  it('요음·작은 모음은 앞 글자와 한 단위로 묶는다', () => {
    expect(tokenizeKana('きょうと')).toEqual(['きょ', 'う', 'と']);
    expect(tokenizeKana('ちゃわん')).toEqual(['ちゃ', 'わ', 'ん']);
  });

  it('촉음 っ은 따로 둔다', () => {
    expect(tokenizeKana('きって')).toEqual(['き', 'っ', 'て']);
  });

  it('앞 글자가 없는 작은 글자는 혼자 한 단위', () => {
    expect(tokenizeKana('ゃき')).toEqual(['ゃ', 'き']);
  });
});
