import type { SessionRecord } from '../record/types';

/** 레벨·종목(`L1`, `test-kana`)별 횟수 */
export type PlayCounts = Readonly<Record<string, number>>;

/**
 * 세션을 남기기 전의 옛 횟수. 기기마다 한 번 만들고, 그 기기만 쓴다 (동기화 설계 §4.3).
 * { 기기 ID: { 레벨·종목: 횟수 } }
 */
export type LegacyPlays = Readonly<Record<string, PlayCounts>>;

/** 끝난 세션을 레벨·종목별로 센다 */
export function countFinishedSessions(sessions: readonly SessionRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    if (session.endedAt !== null) counts[session.levelId] = (counts[session.levelId] ?? 0) + 1;
  }
  return counts;
}

/**
 * 옛 횟수 = 횟수 − 끝난 세션 수 (0보다 큰 것만). 레벨을 칠 때마다 횟수와 세션이 함께 1씩 늘므로
 * 언제 계산해도 같은 값이다
 */
export function legacyPlaysOf(plays: PlayCounts, finished: PlayCounts): Record<string, number> {
  const legacy: Record<string, number> = {};
  for (const [key, count] of Object.entries(plays)) {
    const old = count - (finished[key] ?? 0);
    if (old > 0) legacy[key] = old;
  }
  return legacy;
}

const largerCounts = (a: PlayCounts, b: PlayCounts): PlayCounts => {
  const merged: Record<string, number> = { ...a };
  for (const [key, count] of Object.entries(b)) merged[key] = Math.max(merged[key] ?? 0, count);
  return merged;
};

/** 기기마다, 항목마다 큰 쪽. 순서·중복과 무관하다 */
export function mergeLegacyPlays(a: LegacyPlays, b: LegacyPlays): LegacyPlays {
  const merged: Record<string, PlayCounts> = { ...a };
  for (const [device, counts] of Object.entries(b)) {
    const mine = merged[device];
    merged[device] = mine ? largerCounts(mine, counts) : counts;
  }
  return merged;
}

/**
 * 보이는 횟수 = 끝난 세션 수 + 모든 기기의 옛 횟수 가운데 가장 큰 값.
 * 같은 백업을 가져온 기기들은 같은 옛 횟수를 함께 가지므로, 더하지 않고 큰 값을 쓴다 (동기화 설계 §4.3)
 */
export function playsOf(key: string, finished: PlayCounts, legacy: LegacyPlays): number {
  const old = Math.max(0, ...Object.values(legacy).map((counts) => counts[key] ?? 0));
  return (finished[key] ?? 0) + old;
}
