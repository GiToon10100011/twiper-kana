// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  attemptRecordOf,
  createInputSession,
  createMemoryRepo,
  type SessionRecord,
  type TrainingRepo,
} from '@twiper/core';
import { newId, resilientRepo } from './db';
import { createDexieRepo } from './dexieRepo';

let dbCount = 0;
const freshRepo = () => createDexieRepo(`twiper-test-${(dbCount += 1)}`);

const session = (
  id: string,
  levelId: string,
  startedAt: string,
  ended: boolean,
): SessionRecord => ({
  id,
  levelId,
  startedAt,
  endedAt: ended ? startedAt : null,
  summary: null,
});

describe('createDexieRepo', () => {
  it('레벨별로 끝낸 세션을 최근 순으로 돌려주고, 같은 id는 덮어쓴다', async () => {
    const repo = freshRepo();
    await repo.saveSession(session('S1', 'L1', '2026-10-18T01:00:00.000Z', true));
    await repo.saveSession(session('S2', 'L1', '2026-10-18T02:00:00.000Z', false));
    await repo.saveSession(session('S3', 'L1', '2026-10-18T03:00:00.000Z', true));
    await repo.saveSession(session('S4', 'L2', '2026-10-18T04:00:00.000Z', true));

    expect((await repo.finishedSessions('L1', 10)).map((s) => s.id)).toEqual(['S3', 'S1']);

    await repo.saveSession(session('S2', 'L1', '2026-10-18T02:00:00.000Z', true));

    expect((await repo.finishedSessions('L1', 2)).map((s) => s.id)).toEqual(['S3', 'S2']);
  });

  it('세션의 시도를 id(시각) 순으로 돌려준다', async () => {
    const repo = freshRepo();
    const base = attemptRecordOf(createInputSession('か'), {
      id: '',
      sessionId: 'S',
      levelId: 'L1',
      shownAt: 0,
      at: new Date(0),
    });
    const [a, b] = [newId(), newId()].sort();
    await repo.saveAttempt({ ...base, id: b ?? '' });
    await repo.saveAttempt({ ...base, id: a ?? '' });
    await repo.saveAttempt({ ...base, id: newId(), sessionId: 'other' });

    expect((await repo.attemptsOf('S')).map((x) => x.id)).toEqual([a, b]);
  });

  it('최근 시도를 세션과 관계없이 최근 순으로 limit개 돌려준다', async () => {
    const repo = freshRepo();
    const base = attemptRecordOf(createInputSession('か'), {
      id: '',
      sessionId: 'S',
      levelId: 'L1',
      shownAt: 0,
      at: new Date(0),
    });
    const at = (minute: number) => new Date(Date.UTC(2026, 9, 21, 0, minute)).toISOString();
    await repo.saveAttempt({ ...base, id: 'A2', at: at(2) });
    await repo.saveAttempt({ ...base, id: 'A3', at: at(3), sessionId: 'other' });
    await repo.saveAttempt({ ...base, id: 'A1', at: at(1) });

    expect((await repo.recentAttempts(2)).map((x) => x.id)).toEqual(['A3', 'A2']);
  });

  it('모든 시도의 끝낸 시각과, 어느 시각 이후의 시도를 오래된 순으로 돌려준다', async () => {
    const repo = freshRepo();
    const base = attemptRecordOf(createInputSession('か'), {
      id: '',
      sessionId: 'S',
      levelId: 'L1',
      shownAt: 0,
      at: new Date(0),
    });
    const at = (minute: number) => new Date(Date.UTC(2026, 9, 21, 0, minute)).toISOString();
    await repo.saveAttempt({ ...base, id: 'A2', at: at(2) });
    await repo.saveAttempt({ ...base, id: 'A3', at: at(3) });
    await repo.saveAttempt({ ...base, id: 'A1', at: at(1) });

    expect(await repo.attemptTimes()).toEqual([at(1), at(2), at(3)]);
    expect((await repo.attemptsSince(at(2))).map((x) => x.id)).toEqual(['A2', 'A3']);
  });

  it('기록을 모두 내보내고, 합칠 때는 이미 있는 시도를 건너뛰며 끝나지 않은 세션만 바꾼다', async () => {
    const repo = freshRepo();
    const base = attemptRecordOf(createInputSession('か'), {
      id: '',
      sessionId: 'S',
      levelId: 'L1',
      shownAt: 0,
      at: new Date(0),
    });
    const at = (minute: number) => new Date(Date.UTC(2026, 10, 6, 0, minute)).toISOString();
    await repo.saveAttempt({ ...base, id: 'A2', at: at(2) });
    await repo.saveAttempt({ ...base, id: 'A1', at: at(1) });
    await repo.saveSession(session('S1', 'L1', at(0), false));
    await repo.saveSession(session('S2', 'L1', at(5), true));

    const dump = await repo.dumpRecords();
    expect(dump.attempts.map((x) => x.id)).toEqual(['A1', 'A2']);
    expect(dump.sessions.map((x) => x.id).sort()).toEqual(['S1', 'S2']);

    const incoming = {
      attempts: [
        { ...base, id: 'A1', at: at(1) },
        { ...base, id: 'A3', at: at(3) },
        { ...base, id: 'A3', at: at(3) },
      ],
      sessions: [
        session('S1', 'L1', at(0), true),
        session('S2', 'L1', at(5), false),
        session('S3', 'L2', at(9), true),
      ],
    };
    expect(await repo.mergeRecords(incoming)).toEqual({
      attempts: 1,
      sessions: 2,
      persisted: true,
    });
    expect(await repo.attemptTimes()).toEqual([at(1), at(2), at(3)]);
    expect((await repo.finishedSessions('L1', 10)).map((x) => x.id)).toEqual(['S2', 'S1']);
    // 끝난 세션 수로 플레이 횟수를 다시 센다
    expect(await repo.finishedSessionCounts()).toEqual({ L1: 2, L2: 1 });

    expect(await repo.mergeRecords(incoming)).toEqual({
      attempts: 0,
      sessions: 0,
      persisted: true,
    });
  });
});

describe('resilientRepo', () => {
  it('저장소가 실패하면 메모리 저장소로 바꿔 계속 저장한다', async () => {
    const broken: TrainingRepo = {
      saveAttempt: () => Promise.reject(new Error('blocked')),
      saveSession: () => Promise.reject(new Error('blocked')),
      finishedSessions: () => Promise.reject(new Error('blocked')),
      finishedSessionCounts: () => Promise.reject(new Error('blocked')),
      attemptsOf: () => Promise.reject(new Error('blocked')),
      recentAttempts: () => Promise.reject(new Error('blocked')),
      attemptTimes: () => Promise.reject(new Error('blocked')),
      attemptsSince: () => Promise.reject(new Error('blocked')),
      dumpRecords: () => Promise.reject(new Error('blocked')),
      mergeRecords: () => Promise.reject(new Error('blocked')),
    };
    const repo = resilientRepo(broken, createMemoryRepo());

    await repo.saveSession(session('S1', 'L1', '2026-10-18T01:00:00.000Z', true));

    expect((await repo.finishedSessions('L1', 1)).map((s) => s.id)).toEqual(['S1']);

    // 메모리 저장소에 합친 기록은 다시 열면 사라지므로 가져오기 화면이 경고할 수 있게 알린다
    const merged = await repo.mergeRecords({
      attempts: [],
      sessions: [session('S2', 'L1', '2026-10-18T02:00:00.000Z', true)],
    });
    expect(merged).toEqual({ attempts: 0, sessions: 1, persisted: false });
  });
});
