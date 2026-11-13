// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { bestIn, loadExamRecords, mergeExamRecords, recordExam } from './examRecords';

afterEach(() => localStorage.clear());

const at = new Date('2026-10-22T09:00:00.000Z');

describe('examRecords', () => {
  it('판마다 응시 횟수를 늘리고, 더 빠를 때만 최고 기록을 바꾼다', () => {
    expect(recordExam('kana', { kpm: 100, accuracy: 0.9 }, 1, at)).toMatchObject({
      faster: { kana: true, romaji: false },
      previous: null,
    });
    expect(recordExam('kana', { kpm: 80, accuracy: 1 }, 3, at).faster.kana).toBe(false);
    const third = recordExam('kana', { kpm: 120, accuracy: 0.95 }, 5, at);

    expect(third.faster.kana).toBe(true);
    expect(third.previous?.best?.kpm).toBe(100);
    expect(loadExamRecords().kana).toEqual({
      plays: 3,
      best: { kpm: 120, accuracy: 0.95, minutes: 5, at: '2026-10-22T09:00:00.000Z' },
    });
    expect(loadExamRecords().word).toBeUndefined();
  });

  it('로마자 속도(CPM·WPM)가 가장 빨랐던 판은 가나/분 최고 판과 따로 남긴다', () => {
    recordExam('word', { kpm: 100, accuracy: 0.9, wpm: 40 }, 1, at);
    recordExam('word', { kpm: 110, accuracy: 0.8, wpm: 30 }, 1, at);
    const third = recordExam('word', { kpm: 90, accuracy: 1, wpm: 45 }, 1, at);

    expect(third.faster).toEqual({ kana: false, romaji: true });
    const record = loadExamRecords().word;
    expect(record?.best).toMatchObject({ kpm: 110, wpm: 30 });
    expect(record?.romajiBest).toMatchObject({ kpm: 90, wpm: 45, accuracy: 1 });
    // 설정한 단위에 맞는 판을 고른다
    expect(bestIn('kpm', record)?.kpm).toBe(110);
    expect(bestIn('wpm', record)?.wpm).toBe(45);
    expect(bestIn('cpm', { plays: 1, best: record?.best ?? null })).toBeNull();
  });

  it('백업을 합칠 때 로마자 속도 최고 기록도 빠른 쪽을 남긴다', () => {
    recordExam('word', { kpm: 100, accuracy: 0.9, wpm: 40 }, 1, at);
    const romajiBest = { kpm: 80, wpm: 50, accuracy: 1, minutes: 3, at: at.toISOString() };

    expect(mergeExamRecords({ word: { plays: 1, best: null, romajiBest } }).changed).toBe(1);
    expect(loadExamRecords().word).toMatchObject({ best: { kpm: 100 }, romajiBest: { wpm: 50 } });
    // 같은 파일을 다시 합쳐도 그대로다
    expect(mergeExamRecords({ word: { plays: 1, best: null, romajiBest } }).changed).toBe(0);
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
