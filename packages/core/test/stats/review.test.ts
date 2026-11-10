import { describe, expect, it } from 'vitest';
import { dueReviews, reviewSchedule, type AttemptFlag, type AttemptRecord } from '../../src/index';

let serial = 0;

/** 그날 낮(기기 시간대)에 끝낸 줄. missed는 플릭 실수한 자리 */
function line(
  day: string,
  target: string,
  missed: number[] = [],
  flags: AttemptFlag[] = [],
): AttemptRecord {
  serial += 1;
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const chars = Array.from(target);
  return {
    id: `A${String(serial).padStart(4, '0')}`,
    sessionId: 'S1',
    levelId: 'L1',
    at: new Date(year, month - 1, date, 12, 0, serial).toISOString(),
    target,
    input: target,
    result: missed.length === 0 ? 'correct' : 'corrected',
    judge: 'composing',
    reactionMs: null,
    elapsedMs: 1000,
    unitMs: chars.map(() => null),
    mistakes: missed.map((index) => ({
      index,
      expected: chars[index] ?? '',
      actual: 'さ',
      cause: 'continued',
      kind: 'key',
    })),
    corrections: missed.length,
    flags,
  };
}

const scheduleOf = (attempts: AttemptRecord[]) =>
  reviewSchedule(attempts).map(({ unit, step, due }) => [unit, step, due]);

describe('reviewSchedule', () => {
  it('플릭 실수한 단위는 다음 날 복습하고, 그 전까지 맞혀도 간격이 늘지 않는다', () => {
    expect(scheduleOf([line('2026-11-01', 'かき', [1]), line('2026-11-01', 'かき')])).toEqual([
      ['き', 0, '2026-11-02'],
    ]);
  });

  it('예정일 뒤에 맞히면 3일·7일·21일 뒤로 늘리고, 21일 뒤에도 맞히면 목록에서 뺀다', () => {
    const days = [
      line('2026-11-01', 'き', [0]),
      // 하루 늦게 맞혀도 그날부터 다음 간격을 센다
      line('2026-11-03', 'き'),
    ];
    expect(scheduleOf(days)).toEqual([['き', 1, '2026-11-06']]);

    days.push(line('2026-11-06', 'き'));
    expect(scheduleOf(days)).toEqual([['き', 2, '2026-11-13']]);
    days.push(line('2026-11-13', 'き'));
    expect(scheduleOf(days)).toEqual([['き', 3, '2026-12-04']]);
    days.push(line('2026-12-04', 'き'));
    expect(scheduleOf(days)).toEqual([]);
  });

  it('간격 중간에 다시 틀리면 다음 날로 돌아간다', () => {
    expect(
      scheduleOf([
        line('2026-11-01', 'き', [0]),
        line('2026-11-02', 'き'),
        line('2026-11-05', 'き', [0]),
      ]),
    ).toEqual([['き', 0, '2026-11-06']]);
  });

  it('가타카나는 읽기로 묶고, 로마자로 친 줄·기호·영문자는 보지 않는다', () => {
    expect(
      scheduleOf([
        line('2026-11-01', 'カ', [0]),
        line('2026-11-01', 'さ', [0], ['romaji-suspected']),
        line('2026-11-01', 'あ？', [1]),
        line('2026-11-01', 'OK', [0]),
      ]),
    ).toEqual([['か', 0, '2026-11-02']]);
  });

  it('기록의 순서와 상관없이 시각 순으로 계산한다', () => {
    const missed = line('2026-11-01', 'き', [0]);
    const correct = line('2026-11-02', 'き');

    expect(scheduleOf([correct, missed])).toEqual([['き', 1, '2026-11-05']]);
  });
});

describe('dueReviews', () => {
  it('예정일이 오늘이거나 지난 단위를 오래 밀린 것부터 limit개 낸다', () => {
    const schedule = reviewSchedule([
      line('2026-11-01', 'き', [0]),
      line('2026-11-05', 'さ', [0]),
      line('2026-11-08', 'た', [0]),
      line('2026-11-08', 'な', [0]),
    ]);

    expect(dueReviews(schedule, '2026-11-09').map((item) => item.unit)).toEqual([
      'き',
      'さ',
      'た',
      'な',
    ]);
    expect(dueReviews(schedule, '2026-11-06').map((item) => item.unit)).toEqual(['き', 'さ']);
    expect(dueReviews(schedule, '2026-11-09', 2).map((item) => item.unit)).toEqual(['き', 'さ']);
  });
});
