import {
  dayKey,
  skillStats,
  streakOf,
  weakestSkill,
  type AttemptRecord,
  type SkillStat,
  type Streak,
  type TrainingRepo,
} from '@twiper/core';

/** 약한 규칙을 고를 때 읽는 최근 시도 수. 통계 화면(2000)보다 적게 읽어 홈을 가볍게 한다 */
const RECENT_FOR_WEAKNESS = 500;

/** 홈 「오늘」에 보일 기록 */
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
  /** 다시 연습하면 좋은 규칙. 없으면 null */
  readonly weakest: SkillStat | null;
}

/** 시도 기록에서 「오늘」을 만든다. times는 모든 시도의 끝낸 시각, todays는 오늘 끝낸 시도 */
export function todayFrom(
  times: readonly string[],
  todays: readonly AttemptRecord[],
  recent: readonly AttemptRecord[],
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
    weakest: weakestSkill(skillStats(recent)),
  };
}

/** 저장소에서 「오늘」을 읽는다. 오늘은 기기 시간대의 자정부터다 */
export async function loadToday(repo: TrainingRepo, now = new Date()): Promise<TodayData> {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const [times, todays, recent] = await Promise.all([
    repo.attemptTimes(),
    repo.attemptsSince(midnight),
    repo.recentAttempts(RECENT_FOR_WEAKNESS),
  ]);
  return todayFrom(times, todays, recent, now);
}
