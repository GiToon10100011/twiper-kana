import { describe, expect, it } from 'vitest';
import { createMemoryRepo, type AttemptRecord } from '@twiper/core';
import { loadToday, todayFrom } from './today';

/** 기기 시간대의 2026-10-day hour시에 끝낸 줄 */
const local = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString();

const attempt = (id: string, at: string, target: string, elapsedMs: number): AttemptRecord => ({
  id,
  sessionId: 'S',
  levelId: 'L1',
  at,
  target,
  input: target,
  result: 'correct',
  judge: 'composing',
  reactionMs: null,
  elapsedMs,
  unitMs: [],
  mistakes: [],
  corrections: 0,
  flags: [],
});

describe('todayFrom', () => {
  it('연습한 날을 기기 시간대의 날짜로 모으고, 오늘 친 시간과 글자 수를 더한다', () => {
    const todays = [
      attempt('A', local(24, 9), 'あいうえお', 4000),
      attempt('B', local(24, 10), 'かき', 2000),
    ];
    const times = [local(22, 23), local(23, 0), local(23, 21), ...todays.map((a) => a.at)];
    const data = todayFrom(times, todays, new Date(2026, 9, 24, 12));

    expect(data.today).toBe('2026-10-24');
    expect([...data.days].sort()).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
    expect(data.streak).toEqual({ current: 3, best: 3, today: true });
    expect(data.todayMs).toBe(6000);
    expect(data.todayChars).toBe(7);
  });
});

describe('loadToday', () => {
  it('오늘 자정 이후의 시도만 오늘 친 양으로 센다', async () => {
    const repo = createMemoryRepo();
    await repo.saveAttempt(attempt('A', local(23, 23), 'あいう', 9000));
    await repo.saveAttempt(attempt('B', local(24, 0), 'かきく', 3000));

    const data = await loadToday(repo, new Date(2026, 9, 24, 8));

    expect(data.todayMs).toBe(3000);
    expect(data.streak).toEqual({ current: 2, best: 2, today: true });
  });
});
