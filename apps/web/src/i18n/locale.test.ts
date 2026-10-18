import { describe, expect, it } from 'vitest';
import { detectLocale } from './locale';

describe('detectLocale', () => {
  it('목록에서 처음 나오는 한국어·일본어를 고른다', () => {
    expect(detectLocale(['ja-JP', 'ko-KR'])).toBe('ja');
    expect(detectLocale(['en-US', 'ko-KR', 'ja'])).toBe('ko');
  });

  it('둘 다 없으면 한국어', () => {
    expect(detectLocale(['en-US'])).toBe('ko');
    expect(detectLocale([])).toBe('ko');
  });
});
