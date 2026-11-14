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

/** 거절한 까닭: 키가 다름 · 지운 공간 · 공간이 가득 참 · 너무 잦은 요청 · 다른 압축이 진행 중(또는 임대가 다름) */
export type Denial = 'forbidden' | 'gone' | 'full' | 'rate' | 'busy';

export type PushResult = { readonly seq: number } | { readonly denied: Denial };
export type PullResult =
  | {
      readonly batches: readonly StoredBatch[];
      /** 공간에 쌓인 암호문 크기. 기기가 압축할 때인지 정하는 데 쓴다 */
      readonly bytes: number;
      /** 마지막 압축 직후의 크기 (압축한 적이 없으면 0). 스냅샷만으로 큰 공간을 거듭 압축하지 않게 */
      readonly compactedBytes: number;
    }
  | { readonly denied: Denial };
export type RemoveResult = { readonly removed: true } | { readonly denied: Denial };
export type CompactionResult = { readonly compactionId: string } | { readonly denied: Denial };
export type LeaseResult = { readonly done: true } | { readonly denied: Denial };

/** 공간마다의 한도 */
export interface SpaceLimits {
  /** 쌓인 암호문 크기 (base64 글자 수). 압축 중의 스냅샷 조각은 그 2배까지 받는다 */
  readonly maxBytes: number;
  /** 1분에 올릴 수 있는 묶음 수 */
  readonly pushesPerMinute: number;
}

/** 이만큼 활동이 없는 압축 임대는 버려진 것으로 본다 (§4.6) */
export const LEASE_IDLE_MS = 15 * 60_000;

/** 이만큼 쓰지 않은 공간의 기록은 지운다 (§4.6, 동기화 칸의 안내문과 같다) */
export const RETENTION_MS = 365 * 24 * 60 * 60_000;

/** 받기만 하는 기기도 공간을 쓰는 것으로 치되, 쓴 때는 하루에 한 번만 고쳐 쓴다 */
export const USED_AT_STEP_MS = 24 * 60 * 60_000;

interface SpaceKey {
  readonly space: string;
  readonly authHash: string;
}

export interface SyncStore {
  /**
   * 묶음을 쌓는다. 공간이 없으면 이 키로 만든다. 번호는 공간마다 1부터, 커밋 순서대로.
   * compactionId가 있으면 그 압축의 스냅샷 조각으로 쌓아, 압축을 끝내기 전까지 받기에 보이지 않는다
   */
  push(
    input: SpaceKey & {
      readonly deviceId: string;
      readonly iv: string;
      readonly data: string;
      readonly limits: SpaceLimits;
      readonly compactionId?: string;
    },
  ): Promise<PushResult>;
  /** after보다 큰 번호의 묶음을 limit개까지, 번호 순서로. 아직 없는 공간은 빈 목록 */
  pull(input: SpaceKey & { readonly after: number; readonly limit: number }): Promise<PullResult>;
  /** 묶음을 모두 지우고 「지움」 표시를 남긴다. 그 뒤 같은 키의 요청은 모두 gone */
  remove(input: SpaceKey): Promise<RemoveResult>;
  /**
   * 요청자(IP의 해시)가 1분 안에 보낸 요청을 하나 더 세고, 한도 안이면 true. 함수가 여러 개 떠 있어도
   * 함께 센다 (새 공간을 마구 만드는 요청을 막는다)
   */
  admit(input: { readonly client: string; readonly perMinute: number }): Promise<boolean>;
  /** 압축 임대를 받는다. 공간마다 하나뿐이고, 버려진 임대는 그 조각을 지우고 넘겨받는다 */
  startCompaction(input: SpaceKey & { readonly upTo: number }): Promise<CompactionResult>;
  /** 스냅샷 조각을 보이게 하고 upTo 이하의 묶음을 지운다 (한 트랜잭션) */
  finishCompaction(input: SpaceKey & { readonly compactionId: string }): Promise<LeaseResult>;
  /** 그 임대의 조각만 지우고 임대를 푼다 */
  abortCompaction(input: SpaceKey & { readonly compactionId: string }): Promise<LeaseResult>;
  /**
   * 1년 넘게 쓰지 않은 공간의 묶음을 지우고 「지움」 표시로 바꾼다. 지운 공간 수를 돌려준다. 하루 한 번 예약
   * 작업이 부른다. 표시(행)는 지우지 않는다: 같은 코드로 공간이 다시 생겨 번호가 1부터 다시 시작하면,
   * 예전 커서를 가진 기기가 새 묶음을 조용히 건너뛰기 때문이다. 표시가 남으면 그 기기는 410을 받아 꺼진다
   */
  sweep(): Promise<{ readonly spaces: number }>;
}

interface MemoryBatch extends StoredBatch {
  readonly compactionId: string | null;
}

interface MemorySpace {
  authHash: string;
  nextSeq: number;
  windowStart: number;
  windowCount: number;
  deleted: boolean;
  batches: MemoryBatch[];
  lease: { id: string; upTo: number; at: number } | null;
  compactedBytes: number;
  /** 마지막으로 쓴 때 (올리기, 또는 하루에 한 번 받기) */
  usedAt: number;
  /** 서버의 기록을 지운 때 */
  deletedAt: number | null;
}

const MINUTE = 60_000;

const bytesOf = (space: MemorySpace) => space.batches.reduce((sum, b) => sum + b.data.length, 0);

/** 메모리 저장소 (테스트용). Postgres 구현과 같은 규칙을 따른다 */
export function createMemoryStore(now: () => number = Date.now): SyncStore {
  const spaces = new Map<string, MemorySpace>();
  const clients = new Map<string, { windowStart: number; count: number }>();
  const create = (authHash: string, deleted: boolean): MemorySpace => ({
    authHash,
    nextSeq: 0,
    windowStart: now(),
    windowCount: 0,
    deleted,
    batches: [],
    lease: null,
    compactedBytes: 0,
    usedAt: now(),
    deletedAt: deleted ? now() : null,
  });
  const check = (space: MemorySpace, authHash: string): Denial | null =>
    space.authHash !== authHash ? 'forbidden' : space.deleted ? 'gone' : null;
  /** 그 키의 공간과, 거절할 까닭 */
  const open = ({ space: id, authHash }: SpaceKey) => {
    const space = spaces.get(id);
    return { space, denied: space ? check(space, authHash) : ('forbidden' as Denial) };
  };
  const live = (space: MemorySpace, compactionId: string) =>
    space.lease !== null &&
    space.lease.id === compactionId &&
    now() - space.lease.at < LEASE_IDLE_MS;
  const dropPending = (space: MemorySpace, compactionId: string) => {
    space.batches = space.batches.filter((b) => b.compactionId !== compactionId);
  };

  return {
    push({ space: id, authHash, deviceId, iv, data, limits, compactionId }) {
      const space = spaces.get(id) ?? create(authHash, false);
      spaces.set(id, space);
      const denied = check(space, authHash);
      if (denied) return Promise.resolve({ denied });
      if (compactionId !== undefined && !live(space, compactionId)) {
        return Promise.resolve({ denied: 'busy' });
      }
      const cap = compactionId === undefined ? limits.maxBytes : limits.maxBytes * 2;
      if (bytesOf(space) + data.length > cap) return Promise.resolve({ denied: 'full' });
      const fresh = now() - space.windowStart >= MINUTE;
      if (!fresh && space.windowCount >= limits.pushesPerMinute) {
        return Promise.resolve({ denied: 'rate' });
      }
      space.windowStart = fresh ? now() : space.windowStart;
      space.windowCount = fresh ? 1 : space.windowCount + 1;
      if (compactionId !== undefined && space.lease) space.lease.at = now();
      space.usedAt = now();
      space.nextSeq += 1;
      space.batches.push({
        seq: space.nextSeq,
        deviceId,
        iv,
        data,
        compactionId: compactionId ?? null,
      });
      return Promise.resolve({ seq: space.nextSeq });
    },
    pull({ space: id, authHash, after, limit }) {
      const space = spaces.get(id);
      if (!space) return Promise.resolve({ batches: [], bytes: 0, compactedBytes: 0 });
      const denied = check(space, authHash);
      if (denied) return Promise.resolve({ denied });
      if (now() - space.usedAt >= USED_AT_STEP_MS) space.usedAt = now();
      return Promise.resolve({
        batches: space.batches
          .filter((b) => b.compactionId === null && b.seq > after)
          .slice(0, limit)
          .map(({ seq, deviceId, iv, data }) => ({ seq, deviceId, iv, data })),
        bytes: bytesOf(space),
        compactedBytes: space.compactedBytes,
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
      space.deletedAt = now();
      space.batches = [];
      space.lease = null;
      return Promise.resolve({ removed: true });
    },
    admit({ client, perMinute }) {
      const seen = clients.get(client);
      const fresh = !seen || now() - seen.windowStart >= MINUTE;
      const next = fresh ? { windowStart: now(), count: 1 } : { ...seen, count: seen.count + 1 };
      clients.set(client, next);
      return Promise.resolve(next.count <= perMinute);
    },
    startCompaction(input) {
      const { space, denied } = open(input);
      if (!space || denied) return Promise.resolve({ denied: denied ?? 'forbidden' });
      if (space.lease) {
        if (now() - space.lease.at < LEASE_IDLE_MS) return Promise.resolve({ denied: 'busy' });
        // 버려진 임대: 그 조각을 지우고 넘겨받는다
        dropPending(space, space.lease.id);
      }
      const id = crypto.randomUUID();
      space.lease = { id, upTo: input.upTo, at: now() };
      return Promise.resolve({ compactionId: id });
    },
    finishCompaction(input) {
      const { space, denied } = open(input);
      if (!space || denied) return Promise.resolve({ denied: denied ?? 'forbidden' });
      const lease = space.lease;
      if (!lease || !live(space, input.compactionId)) return Promise.resolve({ denied: 'busy' });
      space.batches = space.batches
        .filter((b) => b.compactionId !== null || b.seq > lease.upTo)
        .map((b) => (b.compactionId === lease.id ? { ...b, compactionId: null } : b));
      space.lease = null;
      space.compactedBytes = bytesOf(space);
      return Promise.resolve({ done: true });
    },
    abortCompaction(input) {
      const { space, denied } = open(input);
      if (!space || denied) return Promise.resolve({ denied: denied ?? 'forbidden' });
      if (space.lease?.id !== input.compactionId) return Promise.resolve({ denied: 'busy' });
      dropPending(space, input.compactionId);
      space.lease = null;
      return Promise.resolve({ done: true });
    },
    sweep() {
      let removed = 0;
      for (const space of spaces.values()) {
        if (space.deleted || now() - space.usedAt < RETENTION_MS) continue;
        space.deleted = true;
        space.deletedAt = now();
        space.batches = [];
        space.lease = null;
        removed += 1;
      }
      return Promise.resolve({ spaces: removed });
    },
  };
}
