import { describe, expect, it } from 'vitest';
import { addDays, dayKey, recentDays, streakOf } from '../../src/index';

describe('dayKey · addDays · recentDays', () => {
  it('기기 시간대의 날짜를 YYYY-MM-DD로 쓴다', () => {
    expect(dayKey(new Date(2026, 9, 24, 23, 59))).toBe('2026-10-24');
    expect(dayKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('달과 해를 넘겨 날짜를 더하고 뺀다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('오늘로 끝나는 최근 7일을 오래된 날부터 낸다', () => {
    expect(recentDays('2026-10-24')).toEqual([
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
    ]);
  });
});

describe('streakOf', () => {
  const today = '2026-10-24';

  it('기록이 없으면 모두 0이다', () => {
    expect(streakOf([], today)).toEqual({ current: 0, best: 0, today: false });
  });

  it('오늘까지 이어진 날을 센다. 같은 날은 하루로 센다', () => {
    const days = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-24'];
    expect(streakOf(days, today)).toEqual({ current: 3, best: 3, today: true });
  });

  it('오늘 아직 안 했으면 어제까지 이어진 날을 센다', () => {
    expect(streakOf(['2026-10-22', '2026-10-23'], today)).toEqual({
      current: 2,
      best: 2,
      today: false,
    });
  });

  it('어제도 안 했으면 끊긴 것이고, 가장 길었던 기록은 따로 남는다', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-22'];
    expect(streakOf(days, today)).toEqual({ current: 0, best: 4, today: false });
  });

  it('달을 넘겨도 이어진다', () => {
    expect(streakOf(['2026-09-30', '2026-10-01'], '2026-10-01').current).toBe(2);
  });
});
