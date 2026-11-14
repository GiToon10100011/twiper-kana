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
): SyncServer<SyncPayload> & { remove(): Promise<void> } {
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
  };
}
