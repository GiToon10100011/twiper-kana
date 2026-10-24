/** 기기 시간대의 날짜 (YYYY-MM-DD). 하루의 경계는 사용자가 사는 곳의 자정이다 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 날짜에 n일을 더한다 (음수면 뺀다) */
export function addDays(day: string, n: number): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return dayKey(new Date(year, month - 1, date + n));
}

/** 오늘로 끝나는 최근 n일, 오래된 날부터 */
export function recentDays(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export interface Streak {
  /** 연습한 날이 이어진 수. 오늘 아직 안 했으면 어제까지 센다. 끊겼으면 0 */
  readonly current: number;
  /** 지금까지 가장 길게 이어진 수 */
  readonly best: number;
  /** 오늘 연습했다 */
  readonly today: boolean;
}

/** 연습한 날들(dayKey)에서 연속 기록을 낸다. 같은 날이 여러 번 있어도 하루로 센다 */
export function streakOf(days: Iterable<string>, today: string): Streak {
  const practiced = new Set(days);
  const doneToday = practiced.has(today);

  let current = 0;
  for (
    let day = doneToday ? today : addDays(today, -1);
    practiced.has(day);
    day = addDays(day, -1)
  ) {
    current += 1;
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...practiced].sort()) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return { current, best, today: doneToday };
}
