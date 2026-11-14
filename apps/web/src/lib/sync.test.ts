// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryRepo,
  createMemorySyncServer,
  type SessionRecord,
  type TrainingRepo,
} from '@twiper/core';
import { loadProgress, recordLevel } from './progress';
import { loadSettings, saveSettings } from './settings';
import { jsonCodec, syncDevice } from './sync';

afterEach(() => localStorage.clear());

/** IndexedDB처럼 다시 열어도 남는 저장소로 치는 메모리 저장소 */
const savedRepo = (): TrainingRepo => {
  const repo = createMemoryRepo();
  return {
    ...repo,
    mergeRecords: async (dump, options) => ({
      ...(await repo.mergeRecords(dump, options)),
      persisted: true,
    }),
  };
};

/** 기기마다 따로인 브라우저 저장소: 지금 localStorage를 떠 두고 다른 기기의 것으로 바꿔 끼운다 */
const storageOf = () =>
  Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]));
const useStorage = (saved: Record<string, string | null>) => {
  localStorage.clear();
  for (const [key, value] of Object.entries(saved))
    if (value !== null) localStorage.setItem(key, value);
};

let played = 0;
/** 레벨을 한 판 끝낸다: 세션을 남기고 진도를 기록한다 (Drill과 같다) */
const play = async (repo: TrainingRepo, levelId: string) => {
  played += 1;
  const at = new Date(Date.UTC(2026, 10, 14, 0, played)).toISOString();
  const session: SessionRecord = {
    id: `S${played}`,
    levelId,
    startedAt: at,
    endedAt: at,
    summary: null,
  };
  await repo.saveSession(session);
  recordLevel(levelId, { accuracy: 0.9, kpm: 40 });
};

describe('sync', () => {
  it('두 기기가 같은 공간으로 주고받으면 기록·횟수·설정이 합쳐지고, 올린 기록은 outbox에서 빠진다', async () => {
    const server = createMemorySyncServer<string>();

    // 기기 A: 두 판, 속도 단위 CPM
    const repoA = savedRepo();
    await play(repoA, 'L1');
    await play(repoA, 'L1');
    saveSettings({ ...loadSettings(), speedUnit: 'cpm' }, 1_000);
    expect(await syncDevice(repoA, server, jsonCodec)).toEqual({
      status: 'done',
      pulled: 0,
      pushed: 1,
    });
    expect((await repoA.pendingRecords()).entries).toEqual([]);
    const storageA = storageOf();

    // 기기 B (저장소가 따로): 한 판 친 뒤 들어온다 → A의 기록과 설정을 받는다
    useStorage({});
    const repoB = savedRepo();
    await play(repoB, 'L1');
    await syncDevice(repoB, server, jsonCodec);
    expect(loadProgress().L1?.plays).toBe(3);
    expect(loadSettings().speedUnit).toBe('cpm');

    // B에서 설정을 바꾸면 기록이 없어도 올린다
    saveSettings({ ...loadSettings(), unlockAll: true }, 2_000);
    expect((await syncDevice(repoB, server, jsonCodec)).status).toBe('done');
    expect(server.envelopes).toHaveLength(3);

    // 다시 A: B의 판과 설정을 받는다. 바뀐 설정 항목을 알려 준다
    useStorage(storageA);
    const onSettings = vi.fn();
    await syncDevice(repoA, server, jsonCodec, onSettings);
    expect(loadProgress().L1?.plays).toBe(3);
    expect(loadSettings()).toMatchObject({ speedUnit: 'cpm', unlockAll: true });
    expect(onSettings).toHaveBeenCalledWith(['unlockAll']);
    expect((await repoA.dumpRecords()).sessions.map((s) => s.id).sort()).toEqual([
      'S1',
      'S2',
      'S3',
    ]);

    // 받은 기록은 다시 올리지 않는다
    expect((await repoA.pendingRecords()).entries).toEqual([]);
    expect(await syncDevice(repoA, server, jsonCodec)).toEqual({
      status: 'done',
      pulled: 0,
      pushed: 0,
    });
  });

  it('나중에 바꾼 설정이 이긴다: 먼저 바꾼 기기의 값은 덮인다', async () => {
    const server = createMemorySyncServer<string>();
    const repoA = savedRepo();
    saveSettings({ ...loadSettings(), speedUnit: 'wpm' }, 5_000);
    await syncDevice(repoA, server, jsonCodec);

    useStorage({});
    const repoB = savedRepo();
    // B는 더 일찍(시계상) 바꿨지만, A의 값을 받은 뒤에 바꾸면 그보다 늦게 찍힌다
    await syncDevice(repoB, server, jsonCodec);
    saveSettings({ ...loadSettings(), speedUnit: 'kpm' }, 100);
    await syncDevice(repoB, server, jsonCodec);
    expect(loadSettings().speedUnit).toBe('kpm');
  });

  it('받은 기록을 기기에 남기지 못하면 받은 것으로 치지 않고, 다음에 다시 받는다', async () => {
    const server = createMemorySyncServer<string>();
    const repoA = savedRepo();
    await play(repoA, 'L1');
    await syncDevice(repoA, server, jsonCodec);

    useStorage({});
    // IndexedDB를 쓸 수 없어 메모리에만 합쳐지는 기기
    await expect(syncDevice(createMemoryRepo(), server, jsonCodec)).rejects.toThrow();
    expect(localStorage.getItem('twiper.sync.v1')).toBeNull();

    const repoB = savedRepo();
    expect(await syncDevice(repoB, server, jsonCodec)).toMatchObject({ status: 'done', pulled: 1 });
    expect(loadProgress().L1?.plays).toBe(1);
  });

  it('받은 설정을 저장하지 못하면 받은 것으로 치지 않고, 다음에 다시 받는다', async () => {
    const server = createMemorySyncServer<string>();
    saveSettings({ ...loadSettings(), speedUnit: 'cpm' }, 1_000);
    await syncDevice(savedRepo(), server, jsonCodec);

    useStorage({});
    const repoB = savedRepo();
    const original = Storage.prototype.setItem;
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === 'twiper.settings.v1')
        throw new DOMException('저장 공간이 찼음', 'QuotaExceededError');
      original.call(this, key, value);
    });
    await expect(syncDevice(repoB, server, jsonCodec)).rejects.toThrow();
    expect(JSON.parse(localStorage.getItem('twiper.sync.v1') ?? '{}')).not.toHaveProperty(
      'lastSeq',
      1,
    );

    blocked.mockRestore();
    await syncDevice(repoB, server, jsonCodec);
    expect(loadSettings().speedUnit).toBe('cpm');
  });
});
