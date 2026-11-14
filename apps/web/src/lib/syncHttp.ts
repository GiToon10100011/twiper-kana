import type { SyncServer } from '@twiper/core';
import type { SyncKeys, SyncPayload } from './syncCrypto';

/** 동기화 서버가 거절했다. status: 403 키가 다름 · 410 지운 공간 · 413 너무 큼 · 429 너무 잦음 · 507 가득 참 */
export class SyncHttpError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(`동기화 서버가 거절했다 (${status} ${reason})`);
    this.name = 'SyncHttpError';
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const json = { 'content-type': 'application/json' };

const isEnvelope = (value: unknown): value is { seq: number; iv: string; data: string } => {
  const item = value as Record<string, unknown> | null;
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.seq === 'number' &&
    typeof item.iv === 'string' &&
    typeof item.data === 'string'
  );
};

/**
 * 동기화 API(/api/sync)와 주고받는다 (동기화 설계 §4.6). 공간은 주소로, 키는 Authorization 머리로 보낸다.
 * fetchFn·base는 테스트용
 */
export function httpSyncServer(
  keys: Pick<SyncKeys, 'spaceId' | 'authKey'>,
  deviceId: string,
  fetchFn: Fetch = (input, init) => fetch(input, init),
  base = '/api/sync',
): SyncServer<SyncPayload> & {
  remove(): Promise<void>;
  /** 마지막으로 받을 때 서버가 알려 준 공간 크기. 아직 받지 않았으면 null */
  spaceBytes(): number | null;
  /** 압축 임대를 받는다 (§4.6). 다른 기기가 압축 중이면 SyncHttpError(409) */
  startCompaction(upTo: number): Promise<string>;
  /** 스냅샷 조각을 올린다 (끝내기 전까지 받기에 보이지 않는다) */
  pushSnapshot(payload: SyncPayload, compactionId: string): Promise<number>;
  finishCompaction(compactionId: string): Promise<void>;
  abortCompaction(compactionId: string): Promise<void>;
} {
  let bytes: number | null = null;
  const call = async (params: Record<string, string>, init: RequestInit = {}) => {
    const response = await fetchFn(
      `${base}?${new URLSearchParams({ space: keys.spaceId, ...params })}`,
      {
        ...init,
        headers: { authorization: `Bearer ${keys.authKey}`, ...init.headers },
      },
    );
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new SyncHttpError(response.status, typeof body.error === 'string' ? body.error : '');
    }
    return body;
  };
  return {
    async pull(after, limit) {
      const body = await call({ after: String(after), limit: String(limit) });
      if (typeof body.bytes === 'number') bytes = body.bytes;
      const batches = Array.isArray(body.batches) ? body.batches.filter(isEnvelope) : [];
      return batches.map(({ seq, iv, data }) => ({ seq, payload: { iv, data } }));
    },
    async push(payload) {
      const body = await call(
        {},
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId, iv: payload.iv, data: payload.data }),
        },
      );
      if (typeof body.seq !== 'number') throw new SyncHttpError(502, 'seq');
      return body.seq;
    },
    /** 「서버의 기록 지우기」: 묶음을 모두 지우고, 이 코드는 다시 쓸 수 없게 한다 */
    async remove() {
      await call({}, { method: 'DELETE' });
    },
    spaceBytes: () => bytes,
    async startCompaction(upTo) {
      const body = await call(
        { op: 'compact-start' },
        { method: 'POST', headers: json, body: JSON.stringify({ upTo }) },
      );
      if (typeof body.compactionId !== 'string') throw new SyncHttpError(502, 'compactionId');
      return body.compactionId;
    },
    async pushSnapshot(payload, compactionId) {
      const body = await call(
        {},
        {
          method: 'POST',
          headers: { ...json, 'compaction-id': compactionId },
          body: JSON.stringify({ deviceId, iv: payload.iv, data: payload.data }),
        },
      );
      if (typeof body.seq !== 'number') throw new SyncHttpError(502, 'seq');
      return body.seq;
    },
    async finishCompaction(compactionId) {
      await call(
        { op: 'compact-finish' },
        { method: 'POST', headers: json, body: JSON.stringify({ compactionId }) },
      );
    },
    async abortCompaction(compactionId) {
      await call(
        { op: 'compact-abort' },
        { method: 'POST', headers: json, body: JSON.stringify({ compactionId }) },
      );
    },
  };
}
