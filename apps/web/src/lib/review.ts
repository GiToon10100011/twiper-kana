import {
  addDays,
  dayKey,
  dueReviews,
  reviewSchedule,
  type AttemptRecord,
  type ReviewItem,
  type TrainingRepo,
} from '@twiper/core';

/** 복습에 읽어 올 날 수. 간격(1·3·7·21일)을 다 돌고도 밀린 날을 넉넉히 덮는다 */
export const REVIEW_HISTORY_DAYS = 90;

/** 홈에 보일 복습: 오늘 복습할 단위와, 없으면 다음 복습 날 */
export interface ReviewPlan {
  /** 오늘 복습할 단위 (오래 밀린 것부터, 한 판에 칠 만큼) */
  readonly due: readonly ReviewItem[];
  /** 오늘 복습할 단위가 모두 몇 개인지 (한 판에 다 못 칠 수도 있다) */
  readonly dueCount: number;
  /** 오늘 복습할 것이 없을 때 다음 복습 날과 그날의 단위 수. 복습할 단위가 하나도 없으면 null */
  readonly next: { readonly day: string; readonly count: number } | null;
}

/** 시도 기록에서 오늘의 복습을 만든다 */
export function planFrom(attempts: readonly AttemptRecord[], today: string): ReviewPlan {
  const schedule = reviewSchedule(attempts);
  const dueCount = schedule.filter((item) => item.due <= today).length;
  const upcoming = schedule.find((item) => item.due > today);
  return {
    due: dueReviews(schedule, today),
    dueCount,
    next:
      dueCount === 0 && upcoming
        ? {
            day: upcoming.due,
            count: schedule.filter((item) => item.due === upcoming.due).length,
          }
        : null,
  };
}

/** 저장소에서 오늘의 복습을 읽는다. 오늘은 기기 시간대의 자정부터다 */
export async function loadReviewPlan(repo: TrainingRepo, now = new Date()): Promise<ReviewPlan> {
  const today = dayKey(now);
  const since = new Date(`${addDays(today, -(REVIEW_HISTORY_DAYS - 1))}T00:00:00`).toISOString();
  return planFrom(await repo.attemptsSince(since), today);
}
