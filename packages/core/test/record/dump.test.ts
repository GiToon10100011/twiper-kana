import { describe, expect, it } from 'vitest';
import {
  attemptRecordOf,
  createInputSession,
  createMemoryRepo,
  isAttemptRecord,
  isSessionRecord,
  replacesSession,
  summarizeDrill,
  type AttemptRecord,
  type SessionRecord,
} from '../../src/index';

const attempt = (id: string, at: string): AttemptRecord => ({
  ...attemptRecordOf(createInputSession('か'), {
    id,
    sessionId: 'S',
    levelId: 'L1',
    shownAt: 0,
    at: new Date(at),
  }),
});

const session = (id: string, ended: boolean): SessionRecord => ({
  id,
  levelId: 'L1',
  startedAt: '2026-11-06T01:00:00.000Z',
  endedAt: ended ? '2026-11-06T01:02:00.000Z' : null,
  summary: ended ? summarizeDrill([]) : null,
});

describe('isAttemptRecord', () => {
  it('저장한 시도 기록은 JSON으로 오가도 받는다', () => {
    const record = attempt('A1', '2026-11-06T01:00:00.000Z');

    expect(isAttemptRecord(JSON.parse(JSON.stringify(record)))).toBe(true);
    expect(isAttemptRecord({ ...record, surface: '時々' })).toBe(true);
  });

  it('화면과 통계가 읽는 필드가 빠지거나 모양이 다르면 받지 않는다', () => {
    const record = attempt('A1', '2026-11-06T01:00:00.000Z');

    expect(isAttemptRecord(null)).toBe(false);
    expect(isAttemptRecord([record])).toBe(false);
    expect(isAttemptRecord({ ...record, id: 1 })).toBe(false);
    expect(isAttemptRecord({ ...record, at: 'yesterday' })).toBe(false);
    expect(isAttemptRecord({ ...record, result: 'wrong' })).toBe(false);
    expect(isAttemptRecord({ ...record, unitMs: ['fast'] })).toBe(false);
    expect(isAttemptRecord({ ...record, flags: ['cheat'] })).toBe(false);
    expect(
      isAttemptRecord({
        ...record,
        mistakes: [{ index: 0, expected: 'か', actual: 'さ', cause: 'guessed' }],
      }),
    ).toBe(false);
  });
});

describe('isSessionRecord', () => {
  it('끝난 세션과 끝나지 않은 세션을 받고, 요약이 깨진 세션은 받지 않는다', () => {
    expect(isSessionRecord(JSON.parse(JSON.stringify(session('S1', true))))).toBe(true);
    expect(isSessionRecord(session('S2', false))).toBe(true);
    expect(isSessionRecord({ ...session('S3', true), summary: { accuracy: 1 } })).toBe(false);
    expect(isSessionRecord({ ...session('S4', true), endedAt: 'later' })).toBe(false);
  });
});

describe('replacesSession', () => {
  it('없던 세션은 넣고, 끝나지 않은 세션만 끝난 세션으로 바꾼다', () => {
    expect(replacesSession(undefined, session('S', false))).toBe(true);
    expect(replacesSession(session('S', false), session('S', true))).toBe(true);
    expect(replacesSession(session('S', true), session('S', false))).toBe(false);
    expect(replacesSession(session('S', true), session('S', true))).toBe(false);
  });
});

describe('createMemoryRepo 내보내기·합치기', () => {
  it('모든 시도를 오래된 순으로 내보내고, 합칠 때 이미 있는 id는 건너뛴다', async () => {
    const repo = createMemoryRepo();
    await repo.saveAttempt(attempt('A2', '2026-11-06T01:02:00.000Z'));
    await repo.saveAttempt(attempt('A1', '2026-11-06T01:01:00.000Z'));
    await repo.saveSession(session('S1', false));

    const dump = await repo.dumpRecords();
    expect(dump.attempts.map((a) => a.id)).toEqual(['A1', 'A2']);
    expect(dump.sessions.map((s) => s.id)).toEqual(['S1']);

    const added = await repo.mergeRecords({
      attempts: [
        attempt('A1', '2026-11-06T01:01:00.000Z'),
        attempt('A3', '2026-11-06T01:03:00.000Z'),
      ],
      sessions: [session('S1', true), session('S2', true)],
    });

    expect(added).toEqual({ attempts: 1, sessions: 2 });
    expect((await repo.attemptTimes()).length).toBe(3);
    expect((await repo.finishedSessions('L1', 10)).map((s) => s.id).sort()).toEqual(['S1', 'S2']);
  });

  it('같은 묶음을 두 번 합쳐도 기록이 늘지 않는다', async () => {
    const repo = createMemoryRepo();
    const dump = {
      attempts: [attempt('A1', '2026-11-06T01:01:00.000Z')],
      sessions: [session('S1', true)],
    };

    expect(await repo.mergeRecords(dump)).toEqual({ attempts: 1, sessions: 1 });
    expect(await repo.mergeRecords(dump)).toEqual({ attempts: 0, sessions: 0 });
    expect((await repo.dumpRecords()).attempts.length).toBe(1);
  });
});
