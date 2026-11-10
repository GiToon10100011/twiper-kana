import { describe, expect, it } from 'vitest';
import { createMemoryRepo, type AttemptRecord } from '@twiper/core';
import { loadReviewPlan, planFrom } from './review';

let serial = 0;

/** 그날 낮(기기 시간대)에 끝낸 줄. missed는 플릭 실수한 자리 */
function line(day: string, target: string, missed: number[] = []): AttemptRecord {
  serial += 1;
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const chars = Array.from(target);
  return {
    id: `R${String(serial).padStart(4, '0')}`,
    sessionId: 'S1',
    levelId: 'L2',
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
    flags: [],
  };
}

describe('planFrom', () => {
  it('오늘 복습할 단위를 모두 세고, 한 판에는 오래 밀린 것부터 8개까지 담는다', () => {
    const attempts = Array.from('かきくけこさしすせそ', (kana, i) =>
      line(`2026-11-0${(i % 3) + 1}`, kana, [0]),
    );
    const plan = planFrom(attempts, '2026-11-10');

    expect(plan.dueCount).toBe(10);
    expect(plan.due).toHaveLength(8);
    expect(plan.due[0]?.due).toBe('2026-11-02');
    expect(plan.next).toBeNull();
  });

  it('오늘 복습할 것이 없으면 다음 복습 날과 그날의 단위 수를 알린다', () => {
    const plan = planFrom(
      [line('2026-11-09', 'か', [0]), line('2026-11-10', 'き', [0]), line('2026-11-10', 'く', [0])],
      '2026-11-09',
    );

    expect(plan).toEqual({ due: [], dueCount: 0, next: { day: '2026-11-10', count: 1 } });
    expect(planFrom([line('2026-11-10', 'き', [0])], '2026-11-10').next).toEqual({
      day: '2026-11-11',
      count: 1,
    });
  });

  it('틀린 적이 없으면 복습할 것도 다음 복습도 없다', () => {
    expect(planFrom([line('2026-11-09', 'かき')], '2026-11-10')).toEqual({
      due: [],
      dueCount: 0,
      next: null,
    });
  });
});

describe('loadReviewPlan', () => {
  it('저장소의 최근 90일 기록에서 계산한다', async () => {
    const repo = createMemoryRepo();
    await repo.saveAttempt(line('2026-11-08', 'き', [0]));
    // 90일보다 오래된 실수는 보지 않는다
    await repo.saveAttempt(line('2026-07-01', 'さ', [0]));

    const plan = await loadReviewPlan(repo, new Date(2026, 10, 10, 9));

    expect(plan.due.map((item) => item.unit)).toEqual(['き']);
  });
});
