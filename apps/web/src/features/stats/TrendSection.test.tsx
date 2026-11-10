// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AttemptRecord } from '@twiper/core';
import '../../i18n';
import { TrendSection } from './TrendSection';

afterEach(cleanup);

let serial = 0;

/** 그날 저녁(기기 시간대)에 끝낸 5글자 줄. missed는 틀린 자리, ms는 걸린 시간 */
function line(day: string, ms: number, missed: number[] = []): AttemptRecord {
  serial += 1;
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const target = 'かきくけこ';
  return {
    id: `A${String(serial).padStart(4, '0')}`,
    sessionId: 'S1',
    levelId: 'L1',
    at: new Date(year, month - 1, date, 20, 0, serial).toISOString(),
    target,
    input: target,
    result: missed.length === 0 ? 'correct' : 'corrected',
    judge: 'composing',
    reactionMs: null,
    elapsedMs: ms,
    unitMs: Array.from(target, () => null),
    mistakes: missed.map((index) => ({
      index,
      expected: target[index] ?? '',
      actual: 'さ',
      cause: 'continued',
    })),
    corrections: missed.length,
    flags: [],
  };
}

const TODAY = '2026-11-10';

// 그 전 7일(11/1–11/3): 10글자 중 8자리 맞음, 20초 → 80%, 30가나/분
// 최근 7일(11/4–11/10): 11/8과 오늘, 10글자 모두 맞음, 10초 → 100%, 60가나/분
const ATTEMPTS = [
  line('2026-11-01', 10_000, [0]),
  line('2026-11-03', 10_000, [1]),
  line('2026-11-08', 5_000),
  line('2026-11-10', 5_000),
];

const tiles = () =>
  [...document.querySelectorAll('.trend-stats > div')].map((tile) => tile.textContent);

describe('TrendSection', () => {
  it('최근 7일의 정확도·속도·연습한 날을 그 전 7일과의 차이와 함께 먼저 보인다', () => {
    render(<TrendSection attempts={ATTEMPTS} today={TODAY} />);

    expect(tiles()).toEqual([
      '첫 시도 정확도100%그 전 7일보다 +20%p',
      '가나/분60그 전 7일보다 +30',
      '연습한 날2일2줄',
    ]);
  });

  it('정확도와 속도는 꺾은선을 따로 그리고, 처음에는 마지막으로 연습한 날을 읽어 준다', () => {
    render(<TrendSection attempts={ATTEMPTS} today={TODAY} />);

    const charts = screen.getAllByRole('slider');
    expect(charts.map((chart) => chart.getAttribute('aria-label'))).toEqual([
      '최근 7일, 날마다 첫 시도 정확도',
      '최근 7일, 날마다 속도 (가나/분)',
    ]);
    expect(screen.getAllByText('11월 10일 · 100% · 1줄')).toHaveLength(1);
    expect(screen.getByText('11월 10일 · 60 · 1줄')).toBeTruthy();
    // 연습한 날만 점을 찍는다
    expect(charts[0]?.querySelectorAll('.trend-dot')).toHaveLength(2);
  });

  it('화살표·Home·End 키로 날을 옮기면 그날 값을 읽어 주고, 연습하지 않은 날은 그렇다고 알린다', () => {
    render(<TrendSection attempts={ATTEMPTS} today={TODAY} />);
    const [accuracy] = screen.getAllByRole('slider');
    if (!accuracy) throw new Error('그래프 없음');

    // 화면 읽기 프로그램에는 날을 고르는 슬라이더로, 고른 날의 값을 슬라이더 값으로 알린다
    expect(accuracy.getAttribute('aria-valuenow')).toBe('6');
    expect(accuracy.getAttribute('aria-valuetext')).toBe('11월 10일 · 100% · 1줄');
    fireEvent.keyDown(accuracy, { key: 'ArrowLeft' });
    expect(screen.getByText('11월 9일 · 연습 안 함')).toBeTruthy();
    fireEvent.keyDown(accuracy, { key: 'ArrowLeft' });
    expect(screen.getByText('11월 8일 · 100% · 1줄')).toBeTruthy();
    expect(accuracy.getAttribute('aria-valuetext')).toBe('11월 8일 · 100% · 1줄');
    fireEvent.keyDown(accuracy, { key: 'Home' });
    expect(accuracy.getAttribute('aria-valuetext')).toBe('11월 4일 · 연습 안 함');
    fireEvent.keyDown(accuracy, { key: 'End' });
    expect(accuracy.getAttribute('aria-valuenow')).toBe('6');
  });

  it('그래프 값은 숨긴 표로도 읽을 수 있다', () => {
    render(<TrendSection attempts={ATTEMPTS} today={TODAY} />);
    const table = screen.getByRole('table', { name: '최근 7일, 날마다 첫 시도 정확도' });

    expect(
      within(table)
        .getAllByRole('row')
        .map((row) => row.textContent),
    ).toEqual(['11/4–', '11/5–', '11/6–', '11/7–', '11/8100%', '11/9–', '11/10100%']);
  });

  it('30일로 바꾸면 최근 30일을 그 전 30일과 비교하고, 비교할 기록이 없으면 그렇다고 알린다', () => {
    render(<TrendSection attempts={ATTEMPTS} today={TODAY} />);

    fireEvent.click(screen.getByRole('button', { name: '30일' }));
    expect(tiles()[0]).toBe('첫 시도 정확도90%그 전 30일 기록 없음');
    expect(screen.getAllByRole('slider').map((chart) => chart.getAttribute('aria-label'))).toEqual([
      '최근 30일, 날마다 첫 시도 정확도',
      '최근 30일, 날마다 속도 (가나/분)',
    ]);
  });

  it('기간 안에 친 줄이 없으면 그래프 대신 알린다', () => {
    render(<TrendSection attempts={[line('2026-10-01', 5_000)]} today={TODAY} />);

    expect(screen.getByText('최근 7일에 친 줄이 없어요.')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
