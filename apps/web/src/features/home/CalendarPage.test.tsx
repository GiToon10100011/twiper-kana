// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRepo, type AttemptRecord } from '@twiper/core';
import '../../i18n';
import { CalendarPage } from './CalendarPage';

afterEach(cleanup);

/** 기기 시간대의 그날 낮에 끝낸 줄 */
const attempt = (month: number, day: number): AttemptRecord => ({
  id: `A${month}-${day}`,
  sessionId: 'S',
  levelId: 'L1',
  at: new Date(2026, month - 1, day, 12).toISOString(),
  target: 'あいう',
  input: 'あいう',
  result: 'correct',
  judge: 'composing',
  reactionMs: null,
  elapsedMs: 3000,
  unitMs: [],
  mistakes: [],
  corrections: 0,
  flags: [],
});

const NOW = new Date(2026, 9, 24, 15);

async function show(days: readonly [number, number][]) {
  const repo = createMemoryRepo();
  for (const [month, day] of days) await repo.saveAttempt(attempt(month, day));
  render(
    <MemoryRouter>
      <CalendarPage repo={repo} now={NOW} />
    </MemoryRouter>,
  );
  await screen.findByRole('region', { name: '2026년 10월' });
}

describe('CalendarPage (연습한 날)', () => {
  it('이번 달 하나를 보여 주고, 연속·최고·모든 날 수를 보여 준다', async () => {
    await show([
      [9, 30],
      [10, 1],
      [10, 2],
      [10, 24],
    ]);

    expect(screen.getAllByRole('region').map((month) => month.getAttribute('aria-label'))).toEqual([
      '2026년 10월',
    ]);
    const stats = Array.from(document.querySelectorAll('.stats div'), (cell) => cell.textContent);
    expect(stats).toEqual(['지금 연속1일', '최고 연속3일', '연습한 날4일']);
  });

  it('‹ ›로 처음 연습한 달부터 이번 달까지만 넘긴다', async () => {
    await show([
      [9, 30],
      [10, 24],
    ]);
    const prev = () => screen.getByRole('button', { name: '지난달' });
    const next = () => screen.getByRole('button', { name: '다음 달' });

    expect((next() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(prev());
    expect(screen.getByRole('region', { name: '2026년 9월' })).toBeTruthy();
    expect((prev() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(next());
    expect(screen.getByRole('region', { name: '2026년 10월' })).toBeTruthy();
  });

  it('왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 지난달. 짧거나 세로로 민 것은 넘기지 않는다', async () => {
    await show([
      [9, 30],
      [10, 24],
    ]);
    const swipe = (dx: number, dy = 0) => {
      const month = screen.getByRole('region');
      fireEvent.touchStart(month, { touches: [{ clientX: 200, clientY: 300 }] });
      fireEvent.touchEnd(month, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
    };

    swipe(120);
    expect(screen.getByRole('region', { name: '2026년 9월' })).toBeTruthy();
    swipe(-30);
    swipe(-80, 120);
    expect(screen.getByRole('region', { name: '2026년 9월' })).toBeTruthy();
    swipe(-120);
    expect(screen.getByRole('region', { name: '2026년 10월' })).toBeTruthy();
  });

  it('연습한 날과 오늘을 표시하고, 달마다 연습한 날 수를 센다', async () => {
    await show([
      [10, 1],
      [10, 2],
      [10, 24],
    ]);
    const october = screen.getByRole('region', { name: '2026년 10월' });

    expect(within(october).getByRole('heading', { level: 2 }).textContent).toMatch(/3일 연습/);
    const today = october.querySelector('[aria-current="date"]');
    expect(today?.textContent).toBe('24연습함');
    expect(today?.classList.contains('is-done')).toBe(true);
    const tomorrow = Array.from(october.querySelectorAll('.cal-day')).find(
      (cell) => cell.textContent === '25',
    );
    expect(tomorrow?.classList.contains('is-future')).toBe(true);
  });

  it('달력은 일요일부터 시작한다 (2026년 10월 1일은 목요일)', async () => {
    await show([[10, 1]]);
    const october = screen.getByRole('region', { name: '2026년 10월' });
    const firstWeek = within(october).getAllByRole('row')[1];
    const cells = within(firstWeek as HTMLElement).getAllByRole('cell');

    expect(cells.map((cell) => cell.textContent)).toEqual(['', '', '', '', '1연습함', '2', '3']);
  });

  it('기록이 없으면 이번 달만 보여 주고(넘길 곳 없음) 한 줄이라도 치면 표시된다고 알린다', async () => {
    await show([]);

    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect((screen.getByRole('button', { name: '지난달' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/아직 연습한 날이 없어요/)).toBeTruthy();
  });
});
