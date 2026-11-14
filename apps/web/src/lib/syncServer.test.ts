// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRepo, type SessionRecord, type TrainingRepo } from '@twiper/core';
import { handleSync } from '../../server/sync/handler';
import { createMemoryStore } from '../../server/sync/store';
import { deviceId } from './device';
import { loadProgress, recordLevel } from './progress';
import { loadSettings, saveSettings } from './settings';
import { syncDevice } from './sync';
import { cryptoCodec, newSyncCode, syncKeys } from './syncCrypto';
import { httpSyncServer, SyncHttpError } from './syncHttp';

afterEach(() => localStorage.clear());

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

const storageOf = () =>
  Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]));
const useStorage = (saved: Record<string, string | null>) => {
  localStorage.clear();
  for (const [key, value] of Object.entries(saved))
    if (value !== null) localStorage.setItem(key, value);
};

let played = 0;
const play = async (repo: TrainingRepo, levelId: string) => {
  played += 1;
  const at = new Date(Date.UTC(2026, 10, 14, 1, played)).toISOString();
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

describe('동기화 서버 (암호화 + HTTP + API 처리부)', () => {
  it('같은 코드의 두 기기가 서버를 거쳐 기록과 설정을 주고받고, 서버에는 암호문만 남는다', async () => {
    const store = createMemoryStore();
    const requests: { url: string; body: string }[] = [];
    const fetchFn = async (input: string, init?: RequestInit) => {
      requests.push({ url: input, body: typeof init?.body === 'string' ? init.body : '' });
      return handleSync(new Request(new URL(input, 'https://twiper.test'), init), store);
    };
    const code = newSyncCode();
    const connect = async () => {
      const keys = await syncKeys(code);
      return {
        server: httpSyncServer(keys, deviceId(), fetchFn),
        codec: cryptoCodec(keys.encKey),
      };
    };

    // 기기 A
    const repoA = savedRepo();
    await play(repoA, 'L1');
    saveSettings({ ...loadSettings(), speedUnit: 'wpm' }, 1_000);
    const a = await connect();
    expect(await syncDevice(repoA, a.server, a.codec)).toMatchObject({ status: 'done', pushed: 1 });
    const storageA = storageOf();

    // 기기 B: 같은 코드로 들어와 받는다
    useStorage({});
    const repoB = savedRepo();
    await play(repoB, 'L1');
    const b = await connect();
    await syncDevice(repoB, b.server, b.codec);
    expect(loadProgress().L1?.plays).toBe(2);
    expect(loadSettings().speedUnit).toBe('wpm');

    // 다시 A: B의 판을 받는다
    useStorage(storageA);
    await syncDevice(repoA, a.server, a.codec);
    expect(loadProgress().L1?.plays).toBe(2);

    // 서버로 간 것은 기기 ID와 암호문뿐이다: 같은 코드의 키로는 묶음이 풀리고, 다른 키로는 풀리지 않는다
    const posted = requests
      .filter((r) => r.body !== '')
      .map((r) => JSON.parse(r.body) as Record<string, string>);
    expect(posted.length).toBeGreaterThan(0);
    const other = cryptoCodec((await syncKeys(newSyncCode())).encKey);
    for (const body of posted) {
      expect(Object.keys(body).sort()).toEqual(['data', 'deviceId', 'iv']);
      const payload = { iv: body.iv ?? '', data: body.data ?? '' };
      expect(await a.codec.decode(payload)).toMatchObject({ format: 'twiper-sync' });
      await expect(other.decode(payload)).rejects.toThrow();
    }
  });

  it('서버의 기록을 지우면 같은 코드로는 더 주고받을 수 없다 (410)', async () => {
    const store = createMemoryStore();
    const fetchFn = (input: string, init?: RequestInit) =>
      handleSync(new Request(new URL(input, 'https://twiper.test'), init), store);
    const keys = await syncKeys(newSyncCode());
    const server = httpSyncServer(keys, deviceId(), fetchFn);
    await syncDevice(savedRepo(), server, cryptoCodec(keys.encKey));

    await server.remove();
    const error = await syncDevice(savedRepo(), server, cryptoCodec(keys.encKey)).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SyncHttpError);
    expect((error as SyncHttpError).status).toBe(410);
  });
});
