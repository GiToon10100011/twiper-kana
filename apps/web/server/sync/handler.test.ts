// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { handleSync } from './handler';
import { createMemoryStore, type SyncStore } from './store';

const SPACE = 'a'.repeat(32);
const KEY = 'k'.repeat(43);
const OTHER = 'o'.repeat(43);
const DEVICE = '01JD0000000000000000000000';

const request = (
  method: string,
  params: Record<string, string>,
  { key = KEY, body, ip }: { key?: string | null; body?: unknown; ip?: string } = {},
) =>
  new Request(`https://twiper.test/api/sync?${new URLSearchParams(params)}`, {
    method,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(ip ? { 'x-forwarded-for': `${ip}, 10.0.0.1` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const push = (store: SyncStore, data = 'QUJD', key = KEY) =>
  handleSync(
    request('POST', { space: SPACE }, { key, body: { deviceId: DEVICE, iv: 'aXY=', data } }),
    store,
  );

describe('handleSync', () => {
  it('공간마다 번호를 1부터 매겨 쌓고, after 다음부터 돌려준다', async () => {
    const store = createMemoryStore();
    expect(await (await push(store, 'QQ==')).json()).toEqual({ seq: 1 });
    expect(await (await push(store, 'Qg==')).json()).toEqual({ seq: 2 });

    const response = await handleSync(request('GET', { space: SPACE, after: '1' }), store);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      batches: [{ seq: 2, deviceId: DEVICE, iv: 'aXY=', data: 'Qg==' }],
    });
    // 아직 아무도 올리지 않은 공간은 빈 목록이다
    const empty = await handleSync(request('GET', { space: 'b'.repeat(32) }), store);
    expect(await empty.json()).toEqual({ batches: [] });
  });

  it('공간·키·본문이 모양에 맞지 않으면 받지 않는다', async () => {
    const store = createMemoryStore();
    expect((await handleSync(request('GET', { space: 'nope' }), store)).status).toBe(400);
    expect((await handleSync(request('GET', { space: SPACE }, { key: null }), store)).status).toBe(
      401,
    );
    expect(
      (await handleSync(request('GET', { space: SPACE }, { key: 'short' }), store)).status,
    ).toBe(401);
    const bad = request(
      'POST',
      { space: SPACE },
      { body: { deviceId: 'x', iv: 'aXY=', data: 'QQ==' } },
    );
    expect((await handleSync(bad, store)).status).toBe(400);
    expect((await handleSync(request('PUT', { space: SPACE }), store)).status).toBe(405);
  });

  it('다른 키로는 그 공간을 읽거나 쓰거나 지울 수 없다', async () => {
    const store = createMemoryStore();
    await push(store);

    expect((await push(store, 'QQ==', OTHER)).status).toBe(403);
    expect((await handleSync(request('GET', { space: SPACE }, { key: OTHER }), store)).status).toBe(
      403,
    );
    expect(
      (await handleSync(request('DELETE', { space: SPACE }, { key: OTHER }), store)).status,
    ).toBe(403);
  });

  it('지운 공간은 같은 코드로 되살아나지 않는다 (410)', async () => {
    const store = createMemoryStore();
    await push(store);
    expect((await handleSync(request('DELETE', { space: SPACE }), store)).status).toBe(200);

    expect((await push(store)).status).toBe(410);
    expect((await handleSync(request('GET', { space: SPACE }), store)).status).toBe(410);
  });

  it('요청이 너무 크면 413, 1분에 너무 자주 올리면 429', async () => {
    const store = createMemoryStore();
    expect((await push(store, 'A'.repeat(600 * 1024))).status).toBe(413);
    // 글자 수는 한도 안이지만 바이트로는 넘는 본문
    const wide = new Request(`https://twiper.test/api/sync?space=${SPACE}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}` },
      body: '가'.repeat(200 * 1024),
    });
    expect((await handleSync(wide, store)).status).toBe(413);

    for (let i = 0; i < 60; i += 1) expect((await push(store)).status).toBe(200);
    expect((await push(store)).status).toBe(429);
  });

  it('같은 요청자(IP)가 1분에 120번을 넘기면 공간과 관계없이 429, 다른 요청자는 받는다', async () => {
    const store = createMemoryStore();
    const get = (ip: string, space: string) => handleSync(request('GET', { space }, { ip }), store);
    for (let i = 0; i < 120; i += 1) {
      const space = i.toString(16).padStart(32, '0');
      expect((await get('203.0.113.7', space)).status).toBe(200);
    }
    expect((await get('203.0.113.7', 'f'.repeat(32))).status).toBe(429);
    expect((await get('198.51.100.2', 'f'.repeat(32))).status).toBe(200);
  });

  it('공간이 가득 차면 507로 거절한다', async () => {
    const full: SyncStore = {
      ...createMemoryStore(),
      push: () => Promise.resolve({ denied: 'full' }),
    };
    expect((await push(full)).status).toBe(507);
  });
});

describe('createMemoryStore', () => {
  it('1분이 지나면 다시 올릴 수 있고, 한도를 넘는 크기는 받지 않는다', async () => {
    let now = 0;
    const store = createMemoryStore(() => now);
    const limits = { maxBytes: 10, pushesPerMinute: 1 };
    const input = { space: SPACE, authHash: 'h', deviceId: DEVICE, iv: 'aXY=', limits };

    expect(await store.push({ ...input, data: 'QUJD' })).toEqual({ seq: 1 });
    expect(await store.push({ ...input, data: 'QUJD' })).toEqual({ denied: 'rate' });
    now = 60_000;
    expect(await store.push({ ...input, data: 'QUJD' })).toEqual({ seq: 2 });
    now = 120_000;
    expect(await store.push({ ...input, data: 'QUJD' })).toEqual({ denied: 'full' });
  });
});
