// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  attemptRecordOf,
  createInputSession,
  createMemoryRepo,
  type AttemptRecord,
} from '@twiper/core';
import { backupFileName, createBackup, parseBackup, restoreBackup } from './backup';
import { loadExamRecords, recordExam } from './examRecords';
import { loadProgress, recordLevel } from './progress';

afterEach(() => localStorage.clear());

const attempt = (id: string, minute: number): AttemptRecord =>
  attemptRecordOf(createInputSession('か'), {
    id,
    sessionId: 'S',
    levelId: 'L1',
    shownAt: 0,
    at: new Date(Date.UTC(2026, 10, 6, 0, minute)),
  });

const day = (date: number) => new Date(Date.UTC(2026, 10, date, 3));

describe('backup', () => {
  it('진도·종합 테스트 기록·연습 기록을 한 파일에 담고, 다시 읽으면 그대로다', async () => {
    recordLevel('L1', { accuracy: 0.9, kpm: 40 }, day(1));
    recordExam('short', { kpm: 60, accuracy: 0.95 }, 1, day(2));
    const repo = createMemoryRepo();
    await repo.saveAttempt(attempt('A1', 1));

    const backup = await createBackup(repo, day(6));
    const parsed = parseBackup(JSON.stringify(backup));

    expect(parsed).toEqual(backup);
    expect(parsed?.exportedAt).toBe('2026-11-06T03:00:00.000Z');
    expect(Object.keys(parsed?.progress ?? {})).toEqual(['L1']);
    expect(parsed?.exams.short?.best?.kpm).toBe(60);
    expect(parsed?.attempts.map((a) => a.id)).toEqual(['A1']);
  });

  it('파일 이름은 기기 날짜를 붙인다', () => {
    expect(backupFileName(new Date(2026, 10, 6, 23, 59))).toBe('twiper-backup-2026-11-06.json');
  });

  it('twiper 백업이 아니면 읽지 않고, 모양이 다른 기록은 하나씩 뺀다', () => {
    expect(parseBackup('{not json')).toBeNull();
    expect(parseBackup('[]')).toBeNull();
    expect(parseBackup(JSON.stringify({ format: 'other', version: 1 }))).toBeNull();
    expect(parseBackup(JSON.stringify({ format: 'twiper-backup', version: 2 }))).toBeNull();

    const parsed = parseBackup(
      JSON.stringify({
        format: 'twiper-backup',
        version: 1,
        progress: { L1: { plays: 'many' }, L2: day(1) },
        exams: 'none',
        attempts: [attempt('A1', 1), { id: 'A2' }],
        sessions: 'none',
      }),
    );

    expect(parsed).toMatchObject({ progress: {}, exams: {}, sessions: [] });
    expect(parsed?.attempts.map((a) => a.id)).toEqual(['A1']);
  });

  it('가져오면 지금 기록에 합친다: 처음 끝낸 날은 이른 쪽, 횟수·최고 기록은 큰 쪽', async () => {
    recordLevel('L1', { accuracy: 0.8, kpm: 50 }, day(3));
    recordExam('short', { kpm: 70, accuracy: 0.9 }, 1, day(3));
    const repo = createMemoryRepo();
    await repo.saveAttempt(attempt('A1', 1));

    const backup = parseBackup(
      JSON.stringify({
        format: 'twiper-backup',
        version: 1,
        progress: {
          L1: { clearedAt: day(1).toISOString(), plays: 4, bestAccuracy: 0.95, bestKpm: 40 },
          L2: { clearedAt: day(2).toISOString(), plays: 1, bestAccuracy: 1, bestKpm: null },
        },
        exams: {
          short: { plays: 5, best: { kpm: 65, accuracy: 1, minutes: 3, at: day(1).toISOString() } },
          long: { plays: 1, best: null },
        },
        attempts: [attempt('A1', 1), attempt('A2', 2)],
        sessions: [],
      }),
    );
    if (!backup) throw new Error('백업을 읽지 못함');

    expect(await restoreBackup(backup, repo)).toEqual({ attempts: 1, changed: true });
    expect(loadProgress()).toEqual({
      L1: { clearedAt: day(1).toISOString(), plays: 4, bestAccuracy: 0.95, bestKpm: 50 },
      L2: { clearedAt: day(2).toISOString(), plays: 1, bestAccuracy: 1, bestKpm: null },
    });
    expect(loadExamRecords()).toEqual({
      short: { plays: 5, best: { kpm: 70, accuracy: 0.9, minutes: 1, at: day(3).toISOString() } },
      long: { plays: 1, best: null },
    });
    expect((await repo.dumpRecords()).attempts.map((a) => a.id)).toEqual(['A1', 'A2']);
  });

  it('같은 파일을 두 번 가져와도 기록이 늘지 않는다', async () => {
    const source = createMemoryRepo();
    recordLevel('L1', { accuracy: 0.9, kpm: 40 }, day(1));
    recordExam('kana', { kpm: 90, accuracy: 0.9 }, 1, day(1));
    await source.saveAttempt(attempt('A1', 1));
    const backup = await createBackup(source, day(6));
    localStorage.clear();

    const repo = createMemoryRepo();
    expect(await restoreBackup(backup, repo)).toEqual({ attempts: 1, changed: true });
    expect(await restoreBackup(backup, repo)).toEqual({ attempts: 0, changed: false });
    expect(loadProgress().L1?.plays).toBe(1);
    expect(loadExamRecords().kana?.plays).toBe(1);
  });
});
