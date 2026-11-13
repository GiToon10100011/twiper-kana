/** 설정 항목을 바꾼 때 (동기화 설계 §4.4) */
export interface Stamp {
  /** 바꾼 때 (ms). nextStampAt으로 정한다 */
  readonly at: number;
  /** at이 같을 때 이긴 쪽을 정한다 */
  readonly deviceId: string;
}

/** 항목마다 마지막에 바꾼 때 */
export type Stamps<K extends string = string> = Readonly<Partial<Record<K, Stamp>>>;

/** 항목마다 값과, 그 값을 정한 때 */
export type StampedValues<T> = {
  readonly [K in keyof T]?: { readonly value: T[K]; readonly stamp: Stamp };
};

/** a가 b보다 나중인가: at이 크면, 같으면 deviceId가 크면 */
export const isLaterStamp = (a: Stamp, b: Stamp): boolean =>
  a.at > b.at || (a.at === b.at && a.deviceId > b.deviceId);

/**
 * 새로 찍을 때의 at: 지금 시각과, 본 가장 늦은 at + 1 가운데 큰 값.
 * 시계가 늦은 기기라도 남의 값을 본 뒤에 바꾸면 그 값을 이긴다
 */
export function nextStampAt(now: number, seen: Stamps): number {
  const latest = Math.max(0, ...Object.values(seen).map((stamp) => stamp?.at ?? 0));
  return Math.max(now, latest + 1);
}

/** 항목마다 나중에 찍힌 쪽을 남긴다 (last-writer-wins). 순서·중복과 무관하다 */
export function mergeStamped<T>(a: StampedValues<T>, b: StampedValues<T>): StampedValues<T> {
  const merged: { [K in keyof T]?: { readonly value: T[K]; readonly stamp: Stamp } } = { ...a };
  for (const key of Object.keys(b) as (keyof T)[]) {
    const theirs = b[key];
    const mine = merged[key];
    if (theirs && (!mine || isLaterStamp(theirs.stamp, mine.stamp))) merged[key] = theirs;
  }
  return merged;
}
