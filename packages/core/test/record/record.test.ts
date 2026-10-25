import { describe, expect, it } from 'vitest';
import {
  attemptRecordOf,
  createInputSession,
  createMemoryRepo,
  reduceInputSession,
  ulid,
  type InputSessionState,
  type SessionRecord,
} from '../../src/index';

const bytes = (fill: number) => new Uint8Array(10).fill(fill);

function typed(target: string, values: [string, boolean, number][]): InputSessionState {
  return values.reduce(
    (session, [value, composing, t]) => reduceInputSession(session, { t, value, composing }),
    createInputSession(target, 'composing', { completeOnCommit: true }),
  );
}

describe('ulid', () => {
  it('26자 Crockford base32', () => {
    expect(ulid(Date.UTC(2026, 9, 18), bytes(7))).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('시각 순서대로 정렬된다', () => {
    const ids = [3, 1, 2].map((n) => ulid(1_700_000_000_000 + n, bytes(255)));

    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('같은 시각이면 무작위 부분으로 갈린다', () => {
    expect(ulid(1, bytes(0))).not.toBe(ulid(1, bytes(1)));
    expect(ulid(1, bytes(0)).slice(0, 10)).toBe(ulid(1, bytes(1)).slice(0, 10));
  });

  it('무작위 바이트가 모자라면 거부한다', () => {
    expect(() => ulid(1, new Uint8Array(4))).toThrow(RangeError);
  });
});

describe('attemptRecordOf', () => {
  const meta = {
    id: 'A1',
    sessionId: 'S1',
    levelId: 'L2',
    shownAt: 1000,
    at: new Date('2026-10-18T05:00:00Z'),
  };

  it('한 번에 맞힌 줄', () => {
    const session = typed('かき', [
      ['か', true, 1300],
      ['かき', true, 1700],
      ['かき', false, 1900],
    ]);

    expect(attemptRecordOf(session, meta)).toEqual({
      id: 'A1',
      sessionId: 'S1',
      levelId: 'L2',
      at: '2026-10-18T05:00:00.000Z',
      target: 'かき',
      input: 'かき',
      result: 'correct',
      judge: 'composing',
      reactionMs: 300,
      elapsedMs: 700,
      unitMs: [300, 400],
      mistakes: [],
      corrections: 0,
      flags: [],
    });
  });

  it('틀렸다가 고친 줄은 오류와 수정 횟수를 남긴다', () => {
    const session = typed('かき', [
      ['か', true, 1100],
      ['かけ', true, 1200],
      ['かけく', true, 1300],
      ['かけ', true, 1400],
      ['か', true, 1500],
      ['かき', true, 1600],
      ['かき', false, 1700],
    ]);
    const record = attemptRecordOf(session, meta);

    expect(record.result).toBe('corrected');
    expect(record.mistakes).toEqual([
      { index: 1, expected: 'き', actual: 'け', cause: 'continued', kind: 'direction' },
      { index: 2, expected: '', actual: 'く', cause: 'deleted', kind: 'extra' },
    ]);
    // 고쳐야 했던 자리 수: 틀린 け(1)와 넘친 く(2)
    expect(record.corrections).toBe(2);
  });

  it('로마자·토글 의심을 표시한다', () => {
    const session = typed('か', [
      ['k', true, 1100],
      ['か', true, 1200],
      ['か', false, 1300],
    ]);

    expect(attemptRecordOf(session, meta).flags).toEqual(['romaji-suspected']);
  });

  it('한자 표기 목표는 읽기로 기록하고, 確定해야 했던 표기와 실제로 친 값을 남긴다', () => {
    const session = [
      { t: 1100, value: 'ひとびと', composing: true },
      { t: 1300, value: '人々', composing: true },
      { t: 1400, value: '人々', composing: false },
    ].reduce(reduceInputSession, createInputSession('{人々|ひとびと}', 'commit'));
    const record = attemptRecordOf(session, meta);

    expect(record.target).toBe('ひとびと');
    expect(record.surface).toBe('人々');
    expect(record.input).toBe('人々');
    expect(record.unitMs).toEqual([100, 0, 0, 0]);
    expect(record.mistakes).toEqual([]);
  });

  it('한자를 변환하지 않고 確定한 것은 「변환 안 함」으로 기록한다', () => {
    const session = [
      { t: 1100, value: 'ひとびと', composing: true },
      { t: 1200, value: 'ひとびと', composing: false },
    ].reduce(reduceInputSession, createInputSession('{人々|ひとびと}', 'commit'));

    expect(attemptRecordOf(session, meta).mistakes).toEqual([
      { index: 0, expected: '人々', actual: 'ひとびと', cause: 'committed', kind: 'script' },
    ]);
  });
});

describe('createMemoryRepo', () => {
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

  it('끝낸 세션을 최근 순으로 돌려주고, 같은 id는 덮어쓴다', async () => {
    const repo = createMemoryRepo();
    await repo.saveSession(session('S1', 'L1', '2026-10-18T01:00:00.000Z', true));
    await repo.saveSession(session('S2', 'L1', '2026-10-18T02:00:00.000Z', false));
    await repo.saveSession(session('S3', 'L1', '2026-10-18T03:00:00.000Z', true));
    await repo.saveSession(session('S4', 'L2', '2026-10-18T04:00:00.000Z', true));
    await repo.saveSession(session('S2', 'L1', '2026-10-18T02:00:00.000Z', true));

    const ids = (await repo.finishedSessions('L1', 10)).map((s) => s.id);

    expect(ids).toEqual(['S3', 'S2', 'S1']);
    expect((await repo.finishedSessions('L1', 2)).length).toBe(2);
  });

  it('세션의 시도를 저장 순서대로 돌려준다', async () => {
    const repo = createMemoryRepo();
    const attempt = attemptRecordOf(createInputSession('か'), {
      id: 'A',
      sessionId: 'S',
      levelId: 'L1',
      shownAt: 0,
      at: new Date(0),
    });
    await repo.saveAttempt(attempt);
    await repo.saveAttempt({ ...attempt, id: 'B' });
    await repo.saveAttempt({ ...attempt, id: 'C', sessionId: 'other' });

    expect((await repo.attemptsOf('S')).map((a) => a.id)).toEqual(['A', 'B']);
  });

  it('최근 시도를 세션과 관계없이 최근 순으로 limit개 돌려준다', async () => {
    const repo = createMemoryRepo();
    const attempt = attemptRecordOf(createInputSession('か'), {
      id: 'A1',
      sessionId: 'S',
      levelId: 'L1',
      shownAt: 0,
      at: new Date(Date.UTC(2026, 9, 21, 0, 1)),
    });
    await repo.saveAttempt({ ...attempt, id: 'A2', at: '2026-10-21T00:02:00.000Z' });
    await repo.saveAttempt({
      ...attempt,
      id: 'A3',
      at: '2026-10-21T00:03:00.000Z',
      sessionId: 'o',
    });
    await repo.saveAttempt(attempt);

    expect((await repo.recentAttempts(2)).map((a) => a.id)).toEqual(['A3', 'A2']);
  });

  it('모든 시도의 끝낸 시각과, 어느 시각 이후의 시도를 오래된 순으로 돌려준다', async () => {
    const repo = createMemoryRepo();
    const attempt = attemptRecordOf(createInputSession('か'), {
      id: 'A1',
      sessionId: 'S',
      levelId: 'L1',
      shownAt: 0,
      at: new Date(Date.UTC(2026, 9, 21, 0, 1)),
    });
    await repo.saveAttempt({ ...attempt, id: 'A3', at: '2026-10-21T00:03:00.000Z' });
    await repo.saveAttempt(attempt);
    await repo.saveAttempt({ ...attempt, id: 'A2', at: '2026-10-21T00:02:00.000Z' });

    expect(await repo.attemptTimes()).toEqual([
      '2026-10-21T00:01:00.000Z',
      '2026-10-21T00:02:00.000Z',
      '2026-10-21T00:03:00.000Z',
    ]);
    expect((await repo.attemptsSince('2026-10-21T00:02:00.000Z')).map((a) => a.id)).toEqual([
      'A2',
      'A3',
    ]);
  });
});
