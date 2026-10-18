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
});

describe('resilientRepo', () => {
  it('저장소가 실패하면 메모리 저장소로 바꿔 계속 저장한다', async () => {
    const broken: TrainingRepo = {
      saveAttempt: () => Promise.reject(new Error('blocked')),
      saveSession: () => Promise.reject(new Error('blocked')),
      finishedSessions: () => Promise.reject(new Error('blocked')),
      attemptsOf: () => Promise.reject(new Error('blocked')),
    };
    const repo = resilientRepo(broken, createMemoryRepo());

    await repo.saveSession(session('S1', 'L1', '2026-10-18T01:00:00.000Z', true));

    expect((await repo.finishedSessions('L1', 1)).map((s) => s.id)).toEqual(['S1']);
  });
});
