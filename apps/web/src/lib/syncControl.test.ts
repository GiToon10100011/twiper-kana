// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRepo, type TrainingRepo } from '@twiper/core';
import { handleSync } from '../../server/sync/handler';
import { createMemoryStore, type SyncStore } from '../../server/sync/store';
import i18n from '../i18n';
import { loadSettingStamps, loadSettings, saveSettings } from './settings';
import {
  enableSync,
  joinSync,
  loadSyncLink,
  removeSyncSpace,
  runSync,
  turnOffSync,
} from './syncControl';

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('ko');
});

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
  for (const [key, value] of Object.entries(saved)) {
    if (value !== null) localStorage.setItem(key, value);
  }
};

const serverOf = (store: SyncStore) => (input: string, init?: RequestInit) =>
  handleSync(new Request(new URL(input, 'https://twiper.test'), init), store);

describe('syncControl', () => {
  it('켜면 새 코드를 만들고 이 기기의 설정 전부가 공간의 첫 설정이 된다. 코드를 넣은 기기는 그 설정을 따른다', async () => {
    const fetchFn = serverOf(createMemoryStore());

    // 기기 A: 동기화가 생기기 전에 속도 단위를 바꿔 두었다 (바꾼 때가 없다)
    localStorage.setItem(
      'twiper.settings.v1',
      JSON.stringify({ ...loadSettings(), speedUnit: 'wpm' }),
    );
    const link = enableSync(1_000);
    expect(Object.keys(loadSettingStamps()).sort()).toEqual(
      ['helpIdleMs', 'language', 'requireKanji', 'speedUnit', 'unlockAll'].sort(),
    );
    const first = await runSync(savedRepo(), { fetchFn, now: () => 5_000 });
    expect(first).toEqual({ link: { code: link.code, syncedAt: 5_000, problem: null } });

    // 기기 B: 이 기기에서 전체 해금을 켜 두었지만, 코드를 넣으면 공간의 설정(꺼짐)을 따른다
    useStorage({});
    saveSettings({ ...loadSettings(), unlockAll: true }, 9_000);
    expect(joinSync('not a code')).toBeNull();
    expect(joinSync(link.code.toLowerCase())).toMatchObject({ code: link.code });
    await runSync(savedRepo(), { fetchFn });
    expect(loadSettings()).toMatchObject({ speedUnit: 'wpm', unlockAll: false });
  });

  it('받은 설정에 언어가 있으면 화면 언어를 바로 바꾼다', async () => {
    const fetchFn = serverOf(createMemoryStore());
    saveSettings({ ...loadSettings(), language: 'ja' });
    const link = enableSync();
    await runSync(savedRepo(), { fetchFn });

    useStorage({});
    joinSync(link.code);
    await runSync(savedRepo(), { fetchFn });
    expect(i18n.language).toBe('ja');
  });

  it('주고받지 못하면 연결 실패를 남기고, 마지막 동기화 때는 그대로 둔다', async () => {
    const fetchFn = serverOf(createMemoryStore());
    enableSync();
    await runSync(savedRepo(), { fetchFn, now: () => 5_000 });

    const offline = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await runSync(savedRepo(), { fetchFn: offline })).toMatchObject({
      link: { syncedAt: 5_000, problem: 'failed' },
    });
    expect(loadSyncLink()?.problem).toBe('failed');
  });

  it('다른 기기에서 서버의 기록을 지우면, 이 기기는 다음 동기화에서 꺼진다', async () => {
    const fetchFn = serverOf(createMemoryStore());
    const link = enableSync();
    await runSync(savedRepo(), { fetchFn });
    const deviceA = storageOf();

    useStorage({});
    joinSync(link.code);
    await removeSyncSpace({ fetchFn });
    expect(loadSyncLink()).toBeNull();

    useStorage(deviceA);
    expect(await runSync(savedRepo(), { fetchFn })).toEqual({ gone: true });
    expect(loadSyncLink()).toBeNull();
  });

  it('주고받는 중에 또 부르면 같은 결과를 함께 기다리고, 꺼져 있으면 아무것도 하지 않는다', async () => {
    const store = createMemoryStore();
    let requests = 0;
    const fetchFn = (input: string, init?: RequestInit) => {
      requests += 1;
      return serverOf(store)(input, init);
    };
    enableSync();
    const repo = savedRepo();
    const [a, b] = [runSync(repo, { fetchFn }), runSync(repo, { fetchFn })];
    expect(a).toBe(b);
    await a;
    // 받기 한 번 + 처음 올리기 한 번
    expect(requests).toBe(2);

    turnOffSync();
    expect(await runSync(repo, { fetchFn })).toBeNull();
  });

  it('주고받거나 지우는 도중에 끄고 새로 켜면, 늦게 끝난 옛 작업은 새 연결과 커서를 건드리지 않는다', async () => {
    const store = createMemoryStore();
    // 서버 응답을 붙잡아 두었다가 나중에 놓는다
    const held: (() => void)[] = [];
    const slowFetch = (input: string, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        held.push(() => void serverOf(store)(input, init).then(resolve));
      });
    const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
    /** 요청이 하나라도 나갈 때까지 기다린다 */
    const requested = async () => {
      while (held.length === 0) await tick();
    };
    /** 작업이 끝날 때까지 붙잡은 요청을 하나씩 놓는다 */
    const settle = async <T>(work: Promise<T>): Promise<T> => {
      let done = false;
      void work.finally(() => {
        done = true;
      });
      while (!done) {
        held.shift()?.();
        await tick();
      }
      return work;
    };

    enableSync();
    const stale = runSync(savedRepo(), { fetchFn: slowFetch });
    await requested();
    turnOffSync();
    const fresh = enableSync();
    expect(await settle(stale)).toBeNull();
    expect(loadSyncLink()).toEqual(fresh);
    expect(localStorage.getItem('twiper.sync.v1')).toBeNull();

    const removal = removeSyncSpace({ fetchFn: slowFetch });
    await requested();
    turnOffSync();
    const replacement = enableSync();
    expect(await settle(removal)).toBe(false);
    expect(loadSyncLink()).toEqual(replacement);
  });
});
