/**
 * 동기화 공간 저장소 (동기화 설계 §4.6). 서버는 암호문 묶음을 번호 순서대로 쌓아 두었다가 돌려줄 뿐,
 * 내용은 읽지 않는다. 실제 서버는 Postgres(neonStore), 테스트는 메모리로 구현한다
 */

/** 묶음 하나 (iv·data는 base64 암호문) */
export interface StoredBatch {
  readonly seq: number;
  readonly deviceId: string;
  readonly iv: string;
  readonly data: string;
}

/** 거절한 까닭: 키가 다름 · 지운 공간 · 공간이 가득 참 · 너무 잦은 요청 */
export type Denial = 'forbidden' | 'gone' | 'full' | 'rate';

export type PushResult = { readonly seq: number } | { readonly denied: Denial };
export type PullResult = { readonly batches: readonly StoredBatch[] } | { readonly denied: Denial };
export type RemoveResult = { readonly removed: true } | { readonly denied: Denial };

/** 공간마다의 한도 */
export interface SpaceLimits {
  /** 쌓인 암호문 크기 (base64 글자 수) */
  readonly maxBytes: number;
  /** 1분에 올릴 수 있는 묶음 수 */
  readonly pushesPerMinute: number;
}

export interface SyncStore {
  /** 묶음을 쌓는다. 공간이 없으면 이 키로 만든다. 번호는 공간마다 1부터, 커밋 순서대로 */
  push(input: {
    readonly space: string;
    readonly authHash: string;
    readonly deviceId: string;
    readonly iv: string;
    readonly data: string;
    readonly limits: SpaceLimits;
  }): Promise<PushResult>;
  /** after보다 큰 번호의 묶음을 limit개까지, 번호 순서로. 아직 없는 공간은 빈 목록 */
  pull(input: {
    readonly space: string;
    readonly authHash: string;
    readonly after: number;
    readonly limit: number;
  }): Promise<PullResult>;
  /** 묶음을 모두 지우고 「지움」 표시를 남긴다. 그 뒤 같은 키의 요청은 모두 gone */
  remove(input: { readonly space: string; readonly authHash: string }): Promise<RemoveResult>;
  /**
   * 요청자(IP의 해시)가 1분 안에 보낸 요청을 하나 더 세고, 한도 안이면 true. 함수가 여러 개 떠 있어도
   * 함께 센다 (새 공간을 마구 만드는 요청을 막는다)
   */
  admit(input: { readonly client: string; readonly perMinute: number }): Promise<boolean>;
}

interface MemorySpace {
  authHash: string;
  nextSeq: number;
  bytes: number;
  windowStart: number;
  windowCount: number;
  deleted: boolean;
  batches: StoredBatch[];
}

const MINUTE = 60_000;

/** 메모리 저장소 (테스트용). Postgres 구현과 같은 규칙을 따른다 */
export function createMemoryStore(now: () => number = Date.now): SyncStore {
  const spaces = new Map<string, MemorySpace>();
  const clients = new Map<string, { windowStart: number; count: number }>();
  const create = (authHash: string, deleted: boolean): MemorySpace => ({
    authHash,
    nextSeq: 0,
    bytes: 0,
    windowStart: now(),
    windowCount: 0,
    deleted,
    batches: [],
  });
  const check = (space: MemorySpace, authHash: string): Denial | null =>
    space.authHash !== authHash ? 'forbidden' : space.deleted ? 'gone' : null;
  return {
    push({ space: id, authHash, deviceId, iv, data, limits }) {
      const space = spaces.get(id) ?? create(authHash, false);
      spaces.set(id, space);
      const denied = check(space, authHash);
      if (denied) return Promise.resolve({ denied });
      if (space.bytes + data.length > limits.maxBytes) return Promise.resolve({ denied: 'full' });
      const fresh = now() - space.windowStart >= MINUTE;
      if (!fresh && space.windowCount >= limits.pushesPerMinute) {
        return Promise.resolve({ denied: 'rate' });
      }
      space.windowStart = fresh ? now() : space.windowStart;
      space.windowCount = fresh ? 1 : space.windowCount + 1;
      space.nextSeq += 1;
      space.bytes += data.length;
      space.batches.push({ seq: space.nextSeq, deviceId, iv, data });
      return Promise.resolve({ seq: space.nextSeq });
    },
    pull({ space: id, authHash, after, limit }) {
      const space = spaces.get(id);
      if (!space) return Promise.resolve({ batches: [] });
      const denied = check(space, authHash);
      if (denied) return Promise.resolve({ denied });
      return Promise.resolve({
        batches: space.batches.filter((b) => b.seq > after).slice(0, limit),
      });
    },
    remove({ space: id, authHash }) {
      const space = spaces.get(id);
      // 올린 적이 없어도 이 코드는 다시 쓸 수 없게 표시를 남긴다
      if (!space) {
        spaces.set(id, create(authHash, true));
        return Promise.resolve({ removed: true });
      }
      const denied = check(space, authHash);
      if (denied) return Promise.resolve({ denied });
      space.deleted = true;
      space.batches = [];
      space.bytes = 0;
      return Promise.resolve({ removed: true });
    },
    admit({ client, perMinute }) {
      const seen = clients.get(client);
      const fresh = !seen || now() - seen.windowStart >= MINUTE;
      const next = fresh ? { windowStart: now(), count: 1 } : { ...seen, count: seen.count + 1 };
      clients.set(client, next);
      return Promise.resolve(next.count <= perMinute);
    },
  };
}
