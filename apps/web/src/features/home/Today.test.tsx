// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays, streakOf, type SkillStat } from '@twiper/core';
import '../../i18n';
import type { TodayData } from '../../lib/today';
import { Today, type TodayVariant } from './Today';

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
    weakest: null,
    ...extra,
  };
}

const dakuten: SkillStat = {
  skill: 'dakuten',
  samples: 30,
  firstTry: 22,
  accuracy: 0.73,
  medianMs: 900,
};

const show = (value: TodayData, variant: TodayVariant = 'strip') =>
  render(
    <MemoryRouter>
      <Today data={value} variant={variant} />
    </MemoryRouter>,
  );
const today = () => screen.getByRole('region', { name: '오늘' });

describe('Today (홈 「오늘」)', () => {
  it('최근 7일을 보여 주고, 오늘 연습했으면 이어진 날 수와 오늘 친 양을 보여 준다', () => {
    show(data([0, 1, 2, 3, 4, 6], { todayMs: 260_000, todayChars: 128 }));
    const week = within(today()).getByRole('list', { name: '최근 7일' });

    expect(within(week).getAllByRole('listitem')).toHaveLength(7);
    expect(within(week).getAllByRole('listitem').at(-1)?.getAttribute('aria-label')).toBe(
      '오늘 연습함',
    );
    expect(today().textContent).toMatch(/5일 연속/);
    expect(today().textContent).toMatch(/오늘 4분 · 128자/);
  });

  it('오늘 아직이면 어제까지 이어진 날 수와 오늘 치면 며칠째인지 보여 준다', () => {
    show(data([1, 2, 3]));
    expect(today().textContent).toMatch(/3일 연속/);
    expect(today().textContent).toMatch(/오늘 치면 4일째/);
  });

  it('끊겼으면 다시 시작하자고 하고 가장 길었던 기록을 보여 준다', () => {
    show(data([3, 4, 5, 6, 10, 11, 12, 13, 14]));
    expect(today().textContent).toMatch(/다시 시작해요/);
    expect(today().textContent).toMatch(/최고 5일 연속/);
  });

  it('기록이 없으면 첫 줄을 치면 기록된다고 알린다', () => {
    show(data([]));
    expect(today().textContent).toMatch(/첫 줄을 치면 기록돼요/);
    expect(today().textContent).not.toMatch(/연속/);
  });

  it('카드(B안)는 가장 약한 규칙의 레벨로 가는 오늘 추천을 붙이고, 띠(A안)는 붙이지 않는다', () => {
    show(data([0], { weakest: dakuten }), 'card');
    const pick = within(today()).getByRole('link', { name: /다시 하기/ });
    expect(pick.getAttribute('href')).toBe('/train/L11');
    expect(pick.textContent).toMatch(/첫 시도 73%/);

    cleanup();
    show(data([0], { weakest: dakuten }), 'strip');
    expect(within(today()).queryByRole('link')).toBeNull();
  });
});
