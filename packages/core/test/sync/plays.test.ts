import { describe, expect, it } from 'vitest';
import {
  countFinishedSessions,
  legacyPlaysOf,
  mergeLegacyPlays,
  playsOf,
  type SessionRecord,
} from '../../src/index';

const session = (id: string, levelId: string, ended: boolean): SessionRecord => ({
  id,
  levelId,
  startedAt: '2026-11-13T00:00:00.000Z',
  endedAt: ended ? '2026-11-13T00:01:00.000Z' : null,
  summary: null,
});

describe('plays', () => {
  it('끝난 세션만 레벨·종목별로 센다', () => {
    expect(
      countFinishedSessions([
        session('S1', 'L1', true),
        session('S2', 'L1', true),
        session('S3', 'L1', false),
        session('S4', 'test-kana', true),
      ]),
    ).toEqual({ L1: 2, 'test-kana': 1 });
  });

  it('옛 횟수는 횟수에서 끝난 세션 수를 뺀 것이고, 0 이하는 남기지 않는다', () => {
    expect(legacyPlaysOf({ L1: 5, L2: 2, 'test-kana': 1 }, { L1: 2, L2: 3 })).toEqual({
      L1: 3,
      'test-kana': 1,
    });
  });

  it('옛 횟수는 기기마다 항목마다 큰 쪽으로 합치고, 순서·중복과 무관하다', () => {
    const a = { D1: { L1: 3 } };
    const b = { D1: { L1: 1, L2: 2 }, D2: { L1: 4 } };
    const merged = { D1: { L1: 3, L2: 2 }, D2: { L1: 4 } };

    expect(mergeLegacyPlays(a, b)).toEqual(merged);
    expect(mergeLegacyPlays(b, a)).toEqual(merged);
    expect(mergeLegacyPlays(merged, b)).toEqual(merged);
  });

  it('보이는 횟수는 끝난 세션 수 + 기기들의 옛 횟수 가운데 큰 값이다 (같은 백업을 두 번 세지 않는다)', () => {
    const legacy = { D1: { L1: 3 }, D2: { L1: 3, L2: 1 } };

    expect(playsOf('L1', { L1: 2 }, legacy)).toBe(5);
    expect(playsOf('L2', {}, legacy)).toBe(1);
    expect(playsOf('L3', { L3: 4 }, {})).toBe(4);
  });
});
