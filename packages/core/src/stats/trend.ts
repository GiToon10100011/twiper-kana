import { addDays, dayKey, recentDays } from '../progress/streak';
import type { AttemptRecord } from '../record/types';

/** 줄을 모은 실력. 결과 화면과 같은 식으로 센다 (첫 시도 정확도, 가나/분) */
export interface TrendSummary {
  /** 끝낸 줄 수. 0이면 연습하지 않았다 */
  readonly lines: number;
  /** 목표 글자 수 (한자는 읽기로) */
  readonly units: number;
  /** 첫 시도 정확도 (0–1). 줄이 없으면 null */
  readonly accuracy: number | null;
  /** 가나/분. 시간을 잰 줄이 없으면 null */
  readonly kpm: number | null;
}

/** 하루치 실력 */
export interface TrendDay extends TrendSummary {
  /** 기기 시간대의 날짜 (YYYY-MM-DD) */
  readonly day: string;
}

/** 이번 기간과 바로 앞 같은 길이의 기간 */
export interface TrendChange {
  readonly current: TrendSummary;
  readonly previous: TrendSummary;
}

/** 로마자 키보드로 친 줄은 플릭 실력이 아니므로 뺀다 (규칙별 통계와 같다) */
const usable = (attempts: readonly AttemptRecord[]) =>
  attempts.filter((attempt) => !attempt.flags.includes('romaji-suspected'));

/** 결과 화면(lineResultOf·summarizeDrill)과 같은 식: 목표보다 더 친 글자는 틀린 자리로 세지 않는다 */
export function summarizeAttempts(attempts: readonly AttemptRecord[]): TrendSummary {
  const lines = usable(attempts);
  let units = 0;
  let firstTry = 0;
  let timedUnits = 0;
  let ms = 0;
  for (const attempt of lines) {
    const length = Array.from(attempt.target).length;
    const missed = new Set(attempt.mistakes.filter((m) => m.expected !== '').map((m) => m.index));
    units += length;
    firstTry += length - missed.size;
    if (attempt.elapsedMs !== null && attempt.elapsedMs > 0) {
      timedUnits += length;
      ms += attempt.elapsedMs;
    }
  }
  return {
    lines: lines.length,
    units,
    accuracy: units > 0 ? firstTry / units : null,
    kpm: ms > 0 ? timedUnits / (ms / 60_000) : null,
  };
}

const dayOf = (attempt: AttemptRecord) => dayKey(new Date(attempt.at));

/** 오늘로 끝나는 최근 n일의 날마다 실력, 오래된 날부터. 연습하지 않은 날은 lines 0 */
export function dailyTrend(
  attempts: readonly AttemptRecord[],
  today: string,
  days: number,
): TrendDay[] {
  const byDay = new Map<string, AttemptRecord[]>();
  for (const attempt of attempts) {
    const day = dayOf(attempt);
    byDay.set(day, [...(byDay.get(day) ?? []), attempt]);
  }
  return recentDays(today, days).map((day) => ({
    day,
    ...summarizeAttempts(byDay.get(day) ?? []),
  }));
}

/** 오늘로 끝나는 최근 n일과, 그 바로 앞 n일의 실력 (이전 대비 변화) */
export function trendChange(
  attempts: readonly AttemptRecord[],
  today: string,
  days: number,
): TrendChange {
  const start = addDays(today, -(days - 1));
  const previousStart = addDays(start, -days);
  const within = (from: string, to: string) =>
    attempts.filter((attempt) => {
      const day = dayOf(attempt);
      return day >= from && day <= to;
    });
  return {
    current: summarizeAttempts(within(start, today)),
    previous: summarizeAttempts(within(previousStart, addDays(start, -1))),
  };
}
