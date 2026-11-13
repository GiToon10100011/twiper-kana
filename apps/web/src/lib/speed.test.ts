import { describe, expect, it } from 'vitest';
import { speedIn } from './speed';

describe('speedIn', () => {
  it('가나/분은 그대로, CPM은 WPM의 5배, WPM은 그대로 낸다', () => {
    const speeds = { kpm: 60, wpm: 20 };

    expect(speedIn('kpm', speeds)).toBe(60);
    expect(speedIn('cpm', speeds)).toBe(100);
    expect(speedIn('wpm', speeds)).toBe(20);
  });

  it('로마자 속도가 없는 예전 기록은 CPM·WPM으로 바꿀 수 없다', () => {
    expect(speedIn('cpm', { kpm: 60 })).toBeNull();
    expect(speedIn('wpm', { kpm: 60, wpm: null })).toBeNull();
    expect(speedIn('kpm', { kpm: 60 })).toBe(60);
  });
});
