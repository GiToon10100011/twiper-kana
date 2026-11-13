import { describe, expect, it } from 'vitest';
import { mergeExamRecord, mergeLevelRecord } from '../../src/index';

describe('records', () => {
  it('레벨 기록은 처음 끝낸 날은 이른 쪽, 횟수·최고 기록은 큰 쪽으로 합친다', () => {
    const a = { clearedAt: '2026-11-02T00:00:00.000Z', plays: 2, bestAccuracy: 0.9, bestKpm: 50 };
    const b = {
      clearedAt: '2026-11-01T00:00:00.000Z',
      plays: 1,
      bestAccuracy: 0.95,
      bestKpm: null,
    };
    const merged = {
      clearedAt: '2026-11-01T00:00:00.000Z',
      plays: 2,
      bestAccuracy: 0.95,
      bestKpm: 50,
    };

    expect(mergeLevelRecord(a, b)).toEqual(merged);
    expect(mergeLevelRecord(b, a)).toEqual(merged);
  });

  it('종합 테스트 기록은 최고 기록을 가나/분·로마자 속도마다 빠른 쪽으로 합친다', () => {
    const at = '2026-11-13T00:00:00.000Z';
    const kanaFast = { kpm: 110, wpm: 30, accuracy: 0.8, minutes: 1, at };
    const romajiFast = { kpm: 90, wpm: 45, accuracy: 1, minutes: 1, at };

    expect(
      mergeExamRecord(
        { plays: 3, best: kanaFast, romajiBest: kanaFast },
        { plays: 2, best: romajiFast, romajiBest: romajiFast },
      ),
    ).toEqual({ plays: 3, best: kanaFast, romajiBest: romajiFast });
    expect(mergeExamRecord({ plays: 1, best: null }, { plays: 1, best: null })).toEqual({
      plays: 1,
      best: null,
    });
  });
});
