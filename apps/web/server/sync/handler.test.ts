// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { handleSync } from './handler';
import { createMemoryStore, LEASE_IDLE_MS, type SyncStore } from './store';

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
      bytes: 8,
      compactedBytes: 0,
    });
    // 아직 아무도 올리지 않은 공간은 빈 목록이다
    const empty = await handleSync(request('GET', { space: 'b'.repeat(32) }), store);
    expect(await empty.json()).toEqual({ batches: [], bytes: 0, compactedBytes: 0 });
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

describe('압축 (S3b)', () => {
  const key = { space: SPACE, authHash: 'h' };
  const limits = { maxBytes: 12, pushesPerMinute: 100 };
  const put = (store: SyncStore, data: string, compactionId?: string) =>
    store.push({
      ...key,
      deviceId: DEVICE,
      iv: 'aXY=',
      data,
      limits,
      ...(compactionId ? { compactionId } : {}),
    });
  const seqs = async (store: SyncStore) => {
    const result = await store.pull({ ...key, after: 0, limit: 50 });
    return 'denied' in result ? result : result.batches.map((b) => b.seq);
  };

  it('스냅샷 조각은 끝내기 전까지 보이지 않고, 끝내면 upTo 이하를 지우고 조각을 보인다', async () => {
    const store = createMemoryStore();
    await put(store, 'QUJD');
    await put(store, 'REVG');
    const lease = await store.startCompaction({ ...key, upTo: 2 });
    if (!('compactionId' in lease)) throw new Error('임대를 받지 못함');
    // 압축 중에 다른 기기가 올린 묶음은 그대로 보인다
    await put(store, 'R0hJ');
    // 한도(12)를 넘지만 압축 조각은 2배까지 받는다
    expect(await put(store, 'QUJDREVG', lease.compactionId)).toEqual({ seq: 4 });
    expect(await seqs(store)).toEqual([1, 2, 3]);

    expect(await store.finishCompaction({ ...key, compactionId: lease.compactionId })).toEqual({
      done: true,
    });
    expect(await seqs(store)).toEqual([3, 4]);
    // 압축 직후 크기를 기억한다 (다음 압축의 문턱)
    expect(await store.pull({ ...key, after: 0, limit: 50 })).toMatchObject({
      bytes: 12,
      compactedBytes: 12,
    });
  });

  it('임대는 공간마다 하나뿐이고, 취소하면 그 조각만 지운다', async () => {
    const store = createMemoryStore();
    await put(store, 'QUJD');
    const lease = await store.startCompaction({ ...key, upTo: 1 });
    if (!('compactionId' in lease)) throw new Error('임대를 받지 못함');
    expect(await store.startCompaction({ ...key, upTo: 1 })).toEqual({ denied: 'busy' });
    await put(store, 'REVG', lease.compactionId);

    expect(await store.abortCompaction({ ...key, compactionId: lease.compactionId })).toEqual({
      done: true,
    });
    expect(await seqs(store)).toEqual([1]);
    // 끝낸 임대로는 더 올리거나 끝낼 수 없다
    expect(await put(store, 'R0hJ', lease.compactionId)).toEqual({ denied: 'busy' });
    expect(await store.finishCompaction({ ...key, compactionId: lease.compactionId })).toEqual({
      denied: 'busy',
    });
  });

  it('15분 동안 활동이 없는 임대는 버려진 것으로 보고, 다음 압축이 그 조각을 지우고 넘겨받는다', async () => {
    let now = 0;
    const store = createMemoryStore(() => now);
    await put(store, 'QUJD');
    const stale = await store.startCompaction({ ...key, upTo: 1 });
    if (!('compactionId' in stale)) throw new Error('임대를 받지 못함');
    await put(store, 'REVG', stale.compactionId);

    now = LEASE_IDLE_MS;
    const fresh = await store.startCompaction({ ...key, upTo: 1 });
    expect(fresh).toHaveProperty('compactionId');
    expect(await store.finishCompaction({ ...key, compactionId: stale.compactionId })).toEqual({
      denied: 'busy',
    });
    if (!('compactionId' in fresh)) throw new Error('임대를 받지 못함');
    await store.finishCompaction({ ...key, compactionId: fresh.compactionId });
    // 버려진 조각(2번)은 사라졌고, 1번도 upTo라 지워졌다
    expect(await seqs(store)).toEqual([]);
  });

  it('처리부: 임대를 받고 조각을 올려 끝내며, 진행 중인 압축이 있으면 409', async () => {
    const store = createMemoryStore();
    await push(store);
    const post = (op: string, body: unknown) =>
      handleSync(request('POST', { space: SPACE, op }, { body }), store);
    const started = await post('compact-start', { upTo: 1 });
    expect(started.status).toBe(200);
    const { compactionId } = (await started.json()) as { compactionId: string };
    expect((await post('compact-start', { upTo: 1 })).status).toBe(409);

    const piece = new Request(`https://twiper.test/api/sync?space=${SPACE}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${KEY}`,
        'compaction-id': compactionId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ deviceId: DEVICE, iv: 'aXY=', data: 'U05BUA==' }),
    });
    expect(await (await handleSync(piece, store)).json()).toEqual({ seq: 2 });
    expect((await post('compact-finish', { compactionId })).status).toBe(200);
    const listed = await handleSync(request('GET', { space: SPACE }), store);
    expect(
      ((await listed.json()) as { batches: { seq: number }[] }).batches.map((b) => b.seq),
    ).toEqual([2]);
    expect((await post('compact-abort', { compactionId: 'nope' })).status).toBe(400);
  });
});
