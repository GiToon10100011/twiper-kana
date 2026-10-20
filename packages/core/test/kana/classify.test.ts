import { describe, expect, it } from 'vitest';
import {
  classifyMistake,
  danOf,
  isKana,
  toHiragana,
  toKatakana,
  tokenizeKana,
  variantBase,
} from '../../src/index';

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
    ['カ', 'か', 'script'],
    ['ガ', 'カ', 'dakuten'],
    ['ッ', 'ツ', 'small'],
    ['メ', 'ま', 'direction'],
    ['ヒ', 'き', 'key'],
    ['ー', 'う', 'long-vowel'],
    ['ー', 'い', 'long-vowel'],
    ['う', 'ー', 'long-vowel'],
    ['ー', '-', 'long-vowel'],
    ['カ', '亀', 'conversion'],
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

  it('가타카나도 같다. 촉음 ッ과 장음 ー는 따로 둔다', () => {
    expect(tokenizeKana('シャツ')).toEqual(['シャ', 'ツ']);
    expect(tokenizeKana('ベッド')).toEqual(['ベ', 'ッ', 'ド']);
    expect(tokenizeKana('コーヒー')).toEqual(['コ', 'ー', 'ヒ', 'ー']);
  });
});

describe('toHiragana · toKatakana · isKana', () => {
  it('가타카나와 히라가나를 서로 바꾸고, 장음 ー와 다른 문자는 그대로 둔다', () => {
    expect(toHiragana('カメラ')).toBe('かめら');
    expect(toHiragana('コーヒー')).toBe('こーひー');
    expect(toHiragana('ヴァ')).toBe('ゔぁ');
    expect(toKatakana('きゃべつ')).toBe('キャベツ');
    expect(toKatakana('こーひー')).toBe('コーヒー');
    expect(toHiragana('ABC 123')).toBe('ABC 123');
  });

  it('가나 한 글자인지', () => {
    expect(['あ', 'ゃ', 'カ', 'ッ', 'ー'].every(isKana)).toBe(true);
    expect(['亀', 'k', '、', '-', ''].some(isKana)).toBe(false);
  });
});
