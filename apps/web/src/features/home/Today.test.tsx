// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays, streakOf } from '@twiper/core';
import '../../i18n';
import type { TodayData } from '../../lib/today';
import { Today } from './Today';

afterEach(cleanup);

const TODAY = '2026-10-24';

function data(daysAgo: number[], extra: Partial<TodayData> = {}): TodayData {
  const days = new Set(daysAgo.map((n) => addDays(TODAY, -n)));
  return {
    today: TODAY,
    days,
    streak: streakOf(days, TODAY),
    todayMs: 0,
    todayChars: 0,
    ...extra,
  };
}

const show = (value: TodayData) =>
  render(
    <MemoryRouter>
      <Today data={value} />
    </MemoryRouter>,
  );
const strip = () => screen.getByRole('link', { name: /연습한 날 보기/ });
const dots = () => Array.from(document.querySelectorAll('.today-day'));

describe('Today (홈 「오늘」 띠)', () => {
  it('누르면 연습한 날 달력으로 간다', () => {
    show(data([0]));
    expect(strip().getAttribute('href')).toBe('/calendar');
  });

  it('최근 7일 점을 보여 주고, 오늘 연습했으면 이어진 날 수와 오늘 친 양을 읽어 준다', () => {
    show(data([0, 1, 2, 3, 4, 6], { todayMs: 260_000, todayChars: 128 }));

    expect(dots()).toHaveLength(7);
    expect(dots().map((dot) => dot.classList.contains('is-done'))).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(dots().at(-1)?.classList.contains('is-today')).toBe(true);
    expect(strip().getAttribute('aria-label')).toBe('5일 연속, 오늘 4분 · 128자, 연습한 날 보기');
  });

  it('오늘 아직이면 어제까지 이어진 날 수와 오늘 치면 며칠째인지 보여 준다', () => {
    show(data([1, 2, 3]));
    expect(strip().textContent).toMatch(/3일 연속/);
    expect(strip().textContent).toMatch(/오늘 치면 4일째/);
  });

  it('끊겼으면 다시 시작하자고 하고 가장 길었던 기록을 보여 준다', () => {
    show(data([3, 4, 5, 6, 10, 11, 12, 13, 14]));
    expect(strip().textContent).toMatch(/다시 시작해요/);
    expect(strip().textContent).toMatch(/최고 5일 연속/);
  });

  it('기록이 없으면 첫 줄을 치면 기록된다고 알린다', () => {
    show(data([]));
    expect(strip().textContent).toMatch(/첫 줄을 치면 기록돼요/);
    expect(strip().textContent).not.toMatch(/연속/);
  });

  it('1분이 안 되면 「1분 미만」으로 보여 준다', () => {
    show(data([0], { todayMs: 42_000, todayChars: 15 }));
    expect(strip().textContent).toMatch(/오늘 1분 미만 · 15자/);
  });
});
