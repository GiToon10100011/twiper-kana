import { describe, expect, it } from 'vitest';
import { detectLocale, resolveLocale } from './locale';

describe('detectLocale', () => {
  it('목록에서 처음 나오는 한국어·일본어·영어를 고른다', () => {
    expect(detectLocale(['ja-JP', 'ko-KR'])).toBe('ja');
    expect(detectLocale(['fr-FR', 'ko-KR', 'ja'])).toBe('ko');
    expect(detectLocale(['en-US', 'ko-KR'])).toBe('en');
  });

  it('셋 다 없으면 영어', () => {
    expect(detectLocale(['fr-FR'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('resolveLocale', () => {
  it('설정에서 고른 언어가 있으면 기기 언어보다 앞선다', () => {
    expect(resolveLocale('ja', ['ko-KR'])).toBe('ja');
    expect(resolveLocale('auto', ['ko-KR'])).toBe('ko');
  });
});
