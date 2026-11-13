import { describe, expect, it } from 'vitest';
import { mergeStamped, nextStampAt, type StampedValues } from '../../src/index';

interface Prefs {
  readonly speedUnit: string;
  readonly unlockAll: boolean;
}

const stamped = (at: number, deviceId: string) => ({ at, deviceId });

describe('stamp', () => {
  it('항목마다 나중에 바꾼 쪽이 이기고, 때가 같으면 deviceId가 큰 쪽이 이긴다', () => {
    const a: StampedValues<Prefs> = {
      speedUnit: { value: 'cpm', stamp: stamped(10, 'A') },
      unlockAll: { value: true, stamp: stamped(30, 'A') },
    };
    const b: StampedValues<Prefs> = {
      speedUnit: { value: 'wpm', stamp: stamped(20, 'B') },
      unlockAll: { value: false, stamp: stamped(30, 'B') },
    };

    expect(mergeStamped(a, b)).toEqual({
      speedUnit: { value: 'wpm', stamp: stamped(20, 'B') },
      unlockAll: { value: false, stamp: stamped(30, 'B') },
    });
  });

  it('어느 순서로, 몇 번을 합쳐도 같은 값에 이른다', () => {
    const states: StampedValues<Prefs>[] = [
      { speedUnit: { value: 'kpm', stamp: stamped(5, 'C') } },
      { speedUnit: { value: 'cpm', stamp: stamped(9, 'A') } },
      { unlockAll: { value: true, stamp: stamped(7, 'B') } },
    ];
    const orders = [
      [0, 1, 2],
      [2, 1, 0],
      [1, 0, 2, 1],
    ];
    const results = orders.map((order) =>
      order.reduce<StampedValues<Prefs>>((acc, i) => mergeStamped(acc, states[i] ?? {}), {}),
    );

    for (const result of results) expect(result).toEqual(results[0]);
    expect(results[0]?.speedUnit?.value).toBe('cpm');
  });

  it('새로 찍는 때는 지금과, 본 가장 늦은 때 + 1 가운데 큰 값이다', () => {
    expect(nextStampAt(100, {})).toBe(100);
    // 시계가 늦은 기기도 남의 값을 본 뒤에는 그보다 늦게 찍는다
    expect(nextStampAt(100, { speedUnit: stamped(500, 'B') })).toBe(501);
  });
});
