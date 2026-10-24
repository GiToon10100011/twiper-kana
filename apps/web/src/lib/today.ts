import { dayKey, streakOf, type AttemptRecord, type Streak, type TrainingRepo } from '@twiper/core';

/** 홈 「오늘」과 연습한 날 달력에 보일 기록 */
export interface TodayData {
  /** 오늘 (기기 시간대 YYYY-MM-DD) */
  readonly today: string;
  /** 연습한 날들 */
  readonly days: ReadonlySet<string>;
  readonly streak: Streak;
  /** 오늘 끝낸 줄의 입력 시간 합 (ms) */
  readonly todayMs: number;
  /** 오늘 맞게 친 글자 수 */
  readonly todayChars: number;
}

/** 시도 기록에서 「오늘」을 만든다. times는 모든 시도의 끝낸 시각, todays는 오늘 끝낸 시도 */
export function todayFrom(
  times: readonly string[],
  todays: readonly AttemptRecord[],
  now: Date,
): TodayData {
  const today = dayKey(now);
  const days = new Set(times.map((at) => dayKey(new Date(at))));
  return {
    today,
    days,
    streak: streakOf(days, today),
    todayMs: todays.reduce((sum, attempt) => sum + (attempt.elapsedMs ?? 0), 0),
    todayChars: todays.reduce((sum, attempt) => sum + Array.from(attempt.target).length, 0),
  };
}

/** 저장소에서 「오늘」을 읽는다. 오늘은 기기 시간대의 자정부터다 */
export async function loadToday(repo: TrainingRepo, now = new Date()): Promise<TodayData> {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const [times, todays] = await Promise.all([repo.attemptTimes(), repo.attemptsSince(midnight)]);
  return todayFrom(times, todays, now);
}
