import { describe, expect, it } from 'vitest';
import {
  attemptRecordOf,
  buildBatches,
  createInputSession,
  createMemoryRepo,
  createMemorySyncServer,
  mergeLegacyPlays,
  mergeLevelRecord,
  mergeStamped,
  nextStampAt,
  playsOf,
  syncOnce,
  type LegacyPlays,
  type LevelRecord,
  type Stamp,
  type SyncBatch,
  type SyncCodec,
  type SyncCursor,
  type SyncDevice,
  type SyncServer,
} from '../../src/index';

const codec: SyncCodec<string> = {
  encode: (batch) => Promise.resolve(JSON.stringify(batch)),
  decode: (payload) => Promise.resolve(JSON.parse(payload) as unknown),
};

type Settings = Record<string, { readonly value: unknown; readonly stamp: Stamp }>;

/** core 합치기 규칙만으로 움직이는 기기 (웹은 같은 규칙을 localStorage·IndexedDB 위에서 쓴다) */
function createDevice(id: string, legacyL1 = 0) {
  const repo = createMemoryRepo();
  const clearedAt = '2026-11-01T00:00:00.000Z';
  let progress: Record<string, LevelRecord> =
    legacyL1 > 0 ? { L1: { clearedAt, plays: legacyL1, bestAccuracy: 0.9, bestKpm: 40 } } : {};
  let legacy: LegacyPlays = { [id]: legacyL1 > 0 ? { L1: legacyL1 } : {} };
  let settings: Settings = {};
  let settingsDirty = false;
  let cursor: SyncCursor = { lastSeq: 0, uploaded: false };
  let played = 0;

  const device: SyncDevice = {
    loadCursor: () => Promise.resolve(cursor),
    saveCursor: (next) => {
      cursor = next;
      return Promise.resolve();
    },
    async merge(batch) {
      await repo.mergeRecords(batch, { track: false });
      for (const [level, record] of Object.entries(batch.progress)) {
        const mine = progress[level];
        progress = { ...progress, [level]: mine ? mergeLevelRecord(mine, record) : record };
      }
      legacy = mergeLegacyPlays(legacy, batch.legacyPlays);
      // 합친 결과에는 빈 항목이 없다
      settings = mergeStamped(settings, batch.settings) as Settings;
      const finished = await repo.finishedSessionCounts();
      for (const [level, record] of Object.entries(progress)) {
        const plays = Math.max(record.plays, playsOf(level, finished, legacy));
        progress = { ...progress, [level]: { ...record, plays } };
      }
    },
    async collect(full) {
      const pending = await repo.pendingRecords();
      const records = full ? await repo.dumpRecords() : pending;
      const nothing = records.attempts.length === 0 && records.sessions.length === 0;
      if (!full && nothing && !settingsDirty) return { batches: [], done: () => Promise.resolve() };
      const state = { progress, exams: {}, legacyPlays: legacy, settings };
      return {
        // 나눠 올리기도 함께 시험하도록 작게 나눈다
        batches: buildBatches(id, state, records, 3),
        async done() {
          await repo.markPushed(pending.entries);
          settingsDirty = false;
        },
      };
    },
  };

  return {
    device,
    async play(level: string) {
      played += 1;
      const sessionId = `${id}-S${played}`;
      const at = new Date(Date.UTC(2026, 10, 13, 0, played));
      await repo.saveSession({
        id: sessionId,
        levelId: level,
        startedAt: at.toISOString(),
        endedAt: at.toISOString(),
        summary: null,
      });
      await repo.saveAttempt(
        attemptRecordOf(createInputSession('か'), {
          id: `${id}-A${played}`,
          sessionId,
          levelId: level,
          shownAt: 0,
          at,
        }),
      );
      const mine = progress[level];
      progress = {
        ...progress,
        [level]: mine
          ? { ...mine, plays: mine.plays + 1 }
          : { clearedAt: at.toISOString(), plays: 1, bestAccuracy: 1, bestKpm: 50 },
      };
    },
    setSetting(key: string, value: unknown, now: number) {
      const stamps = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v.stamp]));
      settings = {
        ...settings,
        [key]: { value, stamp: { at: nextStampAt(now, stamps), deviceId: id } },
      };
      settingsDirty = true;
    },
    async snapshot() {
      const { attempts, sessions } = await repo.dumpRecords();
      return {
        attempts: attempts.map((a) => a.id).sort(),
        sessions: sessions.map((s) => `${s.id}:${s.endedAt ?? '-'}`).sort(),
        plays: Object.fromEntries(Object.entries(progress).map(([k, v]) => [k, v.plays])),
        settings: Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v.value])),
      };
    },
  };
}

/** 정해진 씨앗으로 같은 순서를 되풀이하는 난수 */
const randomFrom = (seed: number) => {
  let state = seed;
  return (n: number) => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state % n;
  };
};

/** 같은 묶음을 두 번 받거나, 받은 직후 끊긴 것처럼 실패하는 서버 */
const flaky = (server: SyncServer<string>, random: (n: number) => number): SyncServer<string> => ({
  pull: (after, limit) => server.pull(after, limit),
  async push(payload) {
    const seq = await server.push(payload);
    const trouble = random(3);
    if (trouble === 0) await server.push(payload);
    if (trouble === 1) throw new Error('응답을 받기 전에 끊김');
    return seq;
  },
});

describe('syncOnce', () => {
  it('기기 셋이 어느 순서로 주고받아도, 중복·끊김이 있어도 같은 기록·횟수·설정에 이른다', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const random = randomFrom(seed);
      const server = createMemorySyncServer<string>();
      // A와 C는 같은 백업을 가져와 같은 옛 횟수(L1 2판)를 갖고 있다
      const devices = [createDevice('A', 2), createDevice('B'), createDevice('C', 2)];
      let playedL1 = 0;
      for (let step = 0; step < 40; step += 1) {
        const target = devices[random(3)];
        if (!target) continue;
        const action = random(4);
        if (action === 0) {
          const level = random(2) === 0 ? 'L1' : 'L2';
          if (level === 'L1') playedL1 += 1;
          await target.play(level);
        } else if (action === 1) {
          target.setSetting(random(2) === 0 ? 'speedUnit' : 'unlockAll', random(3), 1_000 + step);
        } else {
          const via = action === 3 ? flaky(server, random) : server;
          await syncOnce(target.device, via, codec).catch(() => undefined);
        }
      }
      for (let round = 0; round < 2; round += 1) {
        for (const { device } of devices) await syncOnce(device, server, codec);
      }

      const [first, ...rest] = await Promise.all(devices.map((d) => d.snapshot()));
      for (const snapshot of rest) expect(snapshot).toEqual(first);
      // 옛 횟수는 한 번만 더해진다 (같은 백업을 가져온 A와 C)
      expect(first?.plays.L1).toBe(playedL1 + 2);
    }
  });

  it('처음 켤 때는 기록이 없어도 진도·옛 횟수·설정을 올린다', async () => {
    const server = createMemorySyncServer<string>();
    const a = createDevice('A', 3);
    a.setSetting('speedUnit', 'cpm', 10);
    const b = createDevice('B');

    expect(await syncOnce(a.device, server, codec)).toEqual({
      status: 'done',
      pulled: 0,
      pushed: 1,
    });
    await syncOnce(b.device, server, codec);
    expect(await b.snapshot()).toMatchObject({ plays: { L1: 3 }, settings: { speedUnit: 'cpm' } });
    // 다시 주고받을 때는 자기 묶음(1번)과 B가 처음 올린 묶음(2번)을 받고, 올릴 것이 없으니 올리지 않는다
    expect(await syncOnce(a.device, server, codec)).toEqual({
      status: 'done',
      pulled: 2,
      pushed: 0,
    });
    expect(server.envelopes).toHaveLength(2);
  });

  it('더 높은 버전의 묶음을 만나면 거기서 멈추고, 커서도 그 앞까지만 둔다', async () => {
    const server = createMemorySyncServer<string>();
    const a = createDevice('A');
    await a.play('L1');
    await syncOnce(a.device, server, codec);
    await server.push(JSON.stringify({ format: 'twiper-sync', version: 2, deviceId: 'Z' }));
    const c = createDevice('C');
    await c.play('L2');
    await syncOnce(c.device, server, codec);

    const b = createDevice('B');
    expect(await syncOnce(b.device, server, codec)).toEqual({
      status: 'update-required',
      pulled: 1,
      at: 2,
    });
    expect(await b.device.loadCursor()).toEqual({ lastSeq: 1, uploaded: false });
    // 그 뒤의 묶음(C의 L2)은 합치지 않았다
    expect((await b.snapshot()).plays).toEqual({ L1: 1 });
  });
});

describe('syncOnce 실패', () => {
  it('합치기가 실패하면 커서를 그 앞에 두고 멈춰, 다음에 그 묶음부터 다시 받는다', async () => {
    const server = createMemorySyncServer<string>();
    const a = createDevice('A');
    await a.play('L1');
    await syncOnce(a.device, server, codec);
    const c = createDevice('C');
    await c.play('L2');
    await syncOnce(c.device, server, codec);

    const b = createDevice('B');
    let fail = true;
    const flakyMerge: SyncDevice = {
      ...b.device,
      merge: (batch) =>
        batch.deviceId === 'C' && fail
          ? Promise.reject(new Error('저장 못함'))
          : b.device.merge(batch),
    };
    await expect(syncOnce(flakyMerge, server, codec)).rejects.toThrow('저장 못함');
    expect((await b.device.loadCursor()).lastSeq).toBe(1);

    fail = false;
    await syncOnce(flakyMerge, server, codec);
    expect((await b.snapshot()).plays).toEqual({ L1: 1, L2: 1 });
  });

  it('꽉 찬 페이지인데 커서가 나아가지 않으면 끝없이 받지 않고 멈춘다', async () => {
    const batch = buildBatches(
      'A',
      { progress: {}, exams: {}, legacyPlays: {}, settings: {} },
      {
        attempts: [],
        sessions: [],
      },
    )[0];
    const payload = JSON.stringify(batch);
    // after와 관계없이 늘 같은 두 묶음을 주는 서버
    const stuck: SyncServer<string> = {
      pull: () =>
        Promise.resolve([
          { seq: 1, payload },
          { seq: 2, payload },
        ]),
      push: () => Promise.resolve(3),
    };

    await expect(syncOnce(createDevice('B').device, stuck, codec, 2)).rejects.toThrow(
      '서버가 다음 묶음을 주지 않았다',
    );
  });
});

describe('buildBatches', () => {
  const state = { progress: {}, exams: {}, legacyPlays: {}, settings: {} };
  const session = (id: string) => ({
    id,
    levelId: 'L1',
    startedAt: '2026-11-13T00:00:00.000Z',
    endedAt: null,
    summary: null,
  });

  it('기록을 정한 수씩 나누고, 묶음마다 상태를 함께 싣는다', () => {
    const batches: SyncBatch[] = buildBatches(
      'A',
      state,
      { attempts: [], sessions: ['S1', 'S2', 'S3', 'S4', 'S5'].map(session) },
      2,
    );

    expect(batches.map((b) => b.sessions.length)).toEqual([2, 2, 1]);
    for (const batch of batches) expect(batch).toMatchObject({ deviceId: 'A', version: 1 });
  });

  it('기록이 없어도 상태를 실은 묶음 하나를 만든다', () => {
    expect(buildBatches('A', state, { attempts: [], sessions: [] })).toHaveLength(1);
  });
});
