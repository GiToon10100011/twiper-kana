// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { loadExamRecords, recordExam } from './examRecords';

afterEach(() => localStorage.clear());

const at = new Date('2026-10-22T09:00:00.000Z');

describe('examRecords', () => {
  it('판마다 응시 횟수를 늘리고, 더 빠를 때만 최고 기록을 바꾼다', () => {
    expect(recordExam('kana', { kpm: 100, accuracy: 0.9 }, 1, at)).toMatchObject({
      isBest: true,
      previous: null,
    });
    expect(recordExam('kana', { kpm: 80, accuracy: 1 }, 3, at).isBest).toBe(false);
    const third = recordExam('kana', { kpm: 120, accuracy: 0.95 }, 5, at);

    expect(third.isBest).toBe(true);
    expect(third.previous?.kpm).toBe(100);
    expect(loadExamRecords().kana).toEqual({
      plays: 3,
      best: { kpm: 120, accuracy: 0.95, minutes: 5, at: '2026-10-22T09:00:00.000Z' },
    });
    expect(loadExamRecords().word).toBeUndefined();
  });

  it('하나도 못 쳤으면 응시만 세고 최고 기록은 남기지 않는다', () => {
    recordExam('long', { kpm: 0, accuracy: 0 }, 1, at);

    expect(loadExamRecords().long).toEqual({ plays: 1, best: null });
  });

  it('망가진 값은 버린다', () => {
    localStorage.setItem(
      'twiper.exams.v1',
      JSON.stringify({ kana: { plays: 'x' }, word: { plays: 2, best: null } }),
    );

    expect(loadExamRecords()).toEqual({ word: { plays: 2, best: null } });
  });
});
