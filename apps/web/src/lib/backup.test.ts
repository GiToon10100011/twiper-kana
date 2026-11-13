// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attemptRecordOf,
  createInputSession,
  createMemoryRepo,
  type AttemptRecord,
  type InputErrorCause,
  type JudgeMode,
  type SessionRecord,
  type TrainingRepo,
} from '@twiper/core';
import { backupFileName, createBackup, parseBackup, restoreBackup } from './backup';
import { loadExamRecords, recordExam } from './examRecords';
import { loadProgress, recordLevel } from './progress';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

/** IndexedDB처럼 다시 열어도 남는 저장소로 치는 메모리 저장소 */
const savedRepo = (): TrainingRepo => {
  const repo = createMemoryRepo();
  return {
    ...repo,
    mergeRecords: async (dump) => ({ ...(await repo.mergeRecords(dump)), persisted: true }),
  };
};

const attempt = (id: string, minute: number): AttemptRecord =>
  attemptRecordOf(createInputSession('か'), {
    id,
    sessionId: 'S',
    levelId: 'L1',
    shownAt: 0,
    at: new Date(Date.UTC(2026, 10, 6, 0, minute)),
  });

const day = (date: number) => new Date(Date.UTC(2026, 10, date, 3));

const finished = (id: string, levelId: string): SessionRecord => ({
  id,
  levelId,
  startedAt: day(5).toISOString(),
  endedAt: day(5).toISOString(),
  summary: null,
});

/** 레벨을 한 판 끝낸다: 세션을 남기고 진도를 기록한다 (Drill과 같다) */
const play = async (repo: TrainingRepo, sessionId: string, levelId: string) => {
  await repo.saveSession(finished(sessionId, levelId));
  recordLevel(levelId, { accuracy: 0.9, kpm: 40 }, day(5));
};

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

  it('틀린 원인과 판정 방식이 무엇이든 내보내고 가져오는 동안 시도 기록이 빠지지 않는다', async () => {
    const causes: InputErrorCause[] = ['continued', 'deleted', 'committed'];
    const judges: JudgeMode[] = ['composing', 'commit'];
    const source = createMemoryRepo();
    const saved: AttemptRecord[] = causes.flatMap((cause, i) =>
      judges.map((judge, j) => ({
        ...attempt(`A${i}${j}`, i * 2 + j),
        result: 'corrected' as const,
        judge,
        mistakes: [{ index: 0, expected: 'か', actual: 'さ', cause, kind: 'key' as const }],
        corrections: 1,
      })),
    );
    for (const record of saved) await source.saveAttempt(record);

    const backup = parseBackup(JSON.stringify(await createBackup(source, day(6))));
    if (!backup) throw new Error('백업을 읽지 못함');
    const repo = savedRepo();

    expect(await restoreBackup(backup, repo)).toEqual({
      attempts: saved.length,
      changed: false,
      persisted: true,
    });
    expect((await repo.dumpRecords()).attempts).toEqual(saved);
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
    const repo = savedRepo();
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

    expect(await restoreBackup(backup, repo)).toEqual({
      attempts: 1,
      changed: true,
      persisted: true,
    });
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

    const repo = savedRepo();
    expect(await restoreBackup(backup, repo)).toEqual({
      attempts: 1,
      changed: true,
      persisted: true,
    });
    expect(await restoreBackup(backup, repo)).toEqual({
      attempts: 0,
      changed: false,
      persisted: true,
    });
    expect(loadProgress().L1?.plays).toBe(1);
    expect(loadExamRecords().kana?.plays).toBe(1);
  });

  it('메모리 저장소에 합쳤으면(IndexedDB를 쓸 수 없을 때) 기기에 남지 않았다고 알린다', async () => {
    const source = createMemoryRepo();
    await source.saveAttempt(attempt('A1', 1));
    const backup = await createBackup(source, day(6));

    expect(await restoreBackup(backup, createMemoryRepo())).toEqual({
      attempts: 1,
      changed: false,
      persisted: false,
    });
  });

  it('진도·종합 테스트 기록을 쓰지 못하면 기기에 남지 않았다고 알린다', async () => {
    recordLevel('L1', { accuracy: 0.9, kpm: 40 }, day(1));
    recordExam('kana', { kpm: 90, accuracy: 0.9 }, 1, day(1));
    const backup = await createBackup(createMemoryRepo(), day(6));
    localStorage.clear();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('저장 공간이 찼음', 'QuotaExceededError');
    });

    expect(await restoreBackup(backup, savedRepo())).toEqual({
      attempts: 0,
      changed: true,
      persisted: false,
    });
    expect(loadProgress()).toEqual({});
    // 훈련 결과는 저장하지 못해도 화면에 보여 줄 기록을 돌려준다
    expect(recordLevel('L2', { accuracy: 1, kpm: 50 }, day(6)).L2?.plays).toBe(1);
  });

  it('두 기기의 백업을 서로 가져오면 플레이 횟수가 더해지고, 다시 가져와도 늘지 않는다', async () => {
    // 기기 A에서 두 판
    const deviceA = savedRepo();
    await play(deviceA, 'SA1', 'L1');
    await play(deviceA, 'SA2', 'L1');
    const backup = await createBackup(deviceA, day(6));

    // 기기 B(저장소가 따로)에서 한 판
    localStorage.clear();
    const deviceB = savedRepo();
    await play(deviceB, 'SB1', 'L1');

    await restoreBackup(backup, deviceB);
    expect(loadProgress().L1?.plays).toBe(3);
    await restoreBackup(backup, deviceB);
    expect(loadProgress().L1?.plays).toBe(3);
  });

  it('옛 횟수가 없는 예전 백업은 횟수에서 끝난 세션 수를 뺀 만큼을 옛 횟수로 옮긴다', async () => {
    const backup = parseBackup(
      JSON.stringify({
        format: 'twiper-backup',
        version: 1,
        progress: {
          L1: { clearedAt: day(1).toISOString(), plays: 4, bestAccuracy: 1, bestKpm: 40 },
        },
        exams: {},
        attempts: [],
        sessions: [finished('S1', 'L1')],
      }),
    );
    if (!backup) throw new Error('백업을 읽지 못함');
    const repo = savedRepo();

    // 세션 1판 + 세션을 남기기 전의 3판
    await restoreBackup(backup, repo);
    expect(loadProgress().L1?.plays).toBe(4);
    await restoreBackup(backup, repo);
    expect(loadProgress().L1?.plays).toBe(4);
    // 그 뒤로 친 판은 세션과 함께 하나씩 늘어난다
    await play(repo, 'S2', 'L1');
    await restoreBackup(backup, repo);
    expect(loadProgress().L1?.plays).toBe(5);
  });
});
