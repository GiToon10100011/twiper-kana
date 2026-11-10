import { describe, expect, it } from 'vitest';
import {
  dailyTrend,
  summarizeAttempts,
  trendChange,
  type AttemptFlag,
  type AttemptRecord,
} from '../../src/index';

let serial = 0;

/** 그날 정오(기기 시간대)에 끝낸 줄 한 건. missed는 틀린 자리 */
function line(
  day: string,
  target: string,
  elapsedMs: number | null,
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
    elapsedMs,
    unitMs: chars.map(() => null),
    mistakes: missed.map((index) => ({
      index,
      expected: chars[index] ?? '',
      actual: 'x',
      cause: 'continued',
    })),
    corrections: missed.length,
    flags,
  };
}

describe('summarizeAttempts', () => {
  it('결과 화면과 같이 첫 시도 정확도와 가나/분을 센다', () => {
    const summary = summarizeAttempts([
      // 5글자 중 1자리를 두 번 틀림 → 4/5. 10초
      line('2026-11-09', 'かきくけこ', 10_000, [1, 1]),
      // 5글자 모두 맞음. 5초
      line('2026-11-09', 'さしすせそ', 5_000),
    ]);

    expect(summary).toEqual({ lines: 2, units: 10, accuracy: 9 / 10, kpm: 10 / 0.25 });
  });

  it('로마자 키보드로 친 줄과 더 친 글자는 세지 않고, 시간을 못 잰 줄은 속도에서만 뺀다', () => {
    const extra = {
      ...line('2026-11-09', 'あい', 2_000),
      mistakes: [] as AttemptRecord['mistakes'],
    };
    const summary = summarizeAttempts([
      {
        ...extra,
        mistakes: [{ index: 2, expected: '', actual: 'う', cause: 'continued' }],
      },
      line('2026-11-09', 'かき', null, [0]),
      line('2026-11-09', 'さし', 1_000, [], ['romaji-suspected']),
    ]);

    expect(summary).toEqual({ lines: 2, units: 4, accuracy: 3 / 4, kpm: 2 / (2_000 / 60_000) });
  });

  it('줄이 없으면 정확도와 속도는 null', () => {
    expect(summarizeAttempts([])).toEqual({ lines: 0, units: 0, accuracy: null, kpm: null });
  });
});

describe('dailyTrend', () => {
  it('오늘로 끝나는 n일을 오래된 날부터 내고, 연습하지 않은 날은 줄 0이다', () => {
    const trend = dailyTrend(
      [
        line('2026-11-07', 'かきくけこ', 10_000, [0]),
        line('2026-11-09', 'かきくけこ', 5_000),
        // 범위 밖
        line('2026-11-01', 'かきくけこ', 5_000),
      ],
      '2026-11-09',
      3,
    );

    expect(trend.map((day) => [day.day, day.lines, day.accuracy, day.kpm])).toEqual([
      ['2026-11-07', 1, 4 / 5, 30],
      ['2026-11-08', 0, null, null],
      ['2026-11-09', 1, 1, 60],
    ]);
  });

  it('날짜는 기기 시간대의 자정으로 나눈다', () => {
    const late = {
      ...line('2026-11-08', 'あ', 1_000),
      at: new Date(2026, 10, 8, 23, 59).toISOString(),
    };
    const early = {
      ...line('2026-11-09', 'い', 1_000),
      at: new Date(2026, 10, 9, 0, 1).toISOString(),
    };

    expect(dailyTrend([late, early], '2026-11-09', 2).map((day) => day.lines)).toEqual([1, 1]);
  });
});

describe('trendChange', () => {
  it('최근 n일과 그 앞 n일을 따로 모은다', () => {
    const change = trendChange(
      [
        // 이전 7일 (11/3 – 11/9): 10글자 중 9자리 맞음, 20초
        line('2026-11-03', 'かきくけこ', 10_000, [2]),
        line('2026-11-09', 'かきくけこ', 10_000),
        // 이번 7일 (11/10 – 11/16): 모두 맞음, 10초
        line('2026-11-10', 'かきくけこ', 5_000),
        line('2026-11-16', 'かきくけこ', 5_000),
        // 어느 쪽에도 들지 않음
        line('2026-11-02', 'かきくけこ', 1_000),
      ],
      '2026-11-16',
      7,
    );

    expect(change.current).toEqual({ lines: 2, units: 10, accuracy: 1, kpm: 60 });
    expect(change.previous).toEqual({ lines: 2, units: 10, accuracy: 9 / 10, kpm: 30 });
  });
});
