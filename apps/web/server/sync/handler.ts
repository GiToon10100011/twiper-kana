import type { Denial, SpaceLimits, SyncStore } from './store.js';

/** 서버 한도 (동기화 설계 §4.6) */
export const SYNC_LIMITS = {
  /** 요청 본문 */
  maxRequestBytes: 512 * 1024,
  /** 한 번에 돌려주는 묶음 수 */
  maxPage: 50,
  /** 요청자(IP)마다 1분에 받는 요청 수 */
  clientRequestsPerMinute: 120,
  space: { maxBytes: 20 * 1024 * 1024, pushesPerMinute: 60 } satisfies SpaceLimits,
} as const;

const SPACE = /^[0-9a-f]{32}$/u;
/** authKey는 32바이트 base64url (패딩 없이 43자) */
const AUTH = /^Bearer ([A-Za-z0-9_-]{43})$/u;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;
/** 기기 ID는 ULID */
const DEVICE = /^[0-9A-Z]{26}$/u;

const DENIED: Record<Denial, number> = {
  forbidden: 403,
  gone: 410,
  full: 507,
  rate: 429,
  busy: 409,
};

/** 압축 임대 ID (UUID) */
const LEASE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 요청자: Vercel이 붙여 주는 IP의 해시. 서버에는 IP 자체를 남기지 않는다 */
const clientOf = (request: Request) =>
  sha256Hex(
    `twiper-sync/client/${
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    }`,
  );

const whole = (value: string | null, fallback: number) => {
  const n = Number(value ?? fallback);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 동기화 API (동기화 설계 §4.6). 공간은 주소의 space, 키는 Authorization: Bearer <authKey>로 받고,
 * 서버는 authKey의 SHA-256만 저장한다.
 * - GET    ?space=&after=&limit=  → { batches: [{ seq, deviceId, iv, data }], bytes }
 * - POST   ?space=  { deviceId, iv, data } → { seq }  (Compaction-Id 머리가 있으면 압축의 스냅샷 조각)
 * - POST   ?space=&op=compact-start { upTo } → { compactionId }  (다른 압축이 진행 중이면 409)
 * - POST   ?space=&op=compact-finish|compact-abort { compactionId } → { done: true }
 * - DELETE ?space=  → { removed: true } (그 뒤 같은 코드의 요청은 410)
 */
export async function handleSync(request: Request, store: SyncStore): Promise<Response> {
  const url = new URL(request.url);
  const space = url.searchParams.get('space') ?? '';
  if (!SPACE.test(space)) return json(400, { error: 'space' });
  const key = AUTH.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!key) return json(401, { error: 'auth' });
  const authHash = await sha256Hex(key);
  const admitted = await store.admit({
    client: await clientOf(request),
    perMinute: SYNC_LIMITS.clientRequestsPerMinute,
  });
  if (!admitted) return json(429, { error: 'rate' });

  if (request.method === 'GET') {
    const after = whole(url.searchParams.get('after'), 0);
    const limit = whole(url.searchParams.get('limit'), SYNC_LIMITS.maxPage);
    if (after === null || limit === null || limit < 1) return json(400, { error: 'range' });
    const result = await store.pull({
      space,
      authHash,
      after,
      limit: Math.min(limit, SYNC_LIMITS.maxPage),
    });
    return 'denied' in result
      ? json(DENIED[result.denied], { error: result.denied })
      : json(200, { batches: result.batches, bytes: result.bytes });
  }

  if (request.method === 'POST') {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > SYNC_LIMITS.maxRequestBytes) return json(413, { error: 'size' });
    // 글자 수가 아니라 받은 바이트로 잰다
    const raw = new Uint8Array(await request.arrayBuffer());
    if (raw.byteLength > SYNC_LIMITS.maxRequestBytes) return json(413, { error: 'size' });
    let body: Record<string, unknown>;
    try {
      body = (JSON.parse(new TextDecoder().decode(raw)) ?? {}) as Record<string, unknown>;
    } catch {
      return json(400, { error: 'body' });
    }
    const op = url.searchParams.get('op');
    const answer = (result: { denied: Denial } | Record<string, unknown>) =>
      'denied' in result
        ? json(DENIED[result.denied as Denial], { error: result.denied })
        : json(200, result);

    // 압축 (§4.6): 임대 받기 → 스냅샷 조각 올리기(Compaction-Id 머리) → 끝내기 또는 취소
    if (op === 'compact-start') {
      const upTo = body.upTo;
      if (typeof upTo !== 'number' || !Number.isSafeInteger(upTo) || upTo < 0) {
        return json(400, { error: 'body' });
      }
      return answer(await store.startCompaction({ space, authHash, upTo }));
    }
    if (op === 'compact-finish' || op === 'compact-abort') {
      const compactionId = body.compactionId;
      if (typeof compactionId !== 'string' || !LEASE.test(compactionId)) {
        return json(400, { error: 'body' });
      }
      const input = { space, authHash, compactionId };
      return answer(
        op === 'compact-finish'
          ? await store.finishCompaction(input)
          : await store.abortCompaction(input),
      );
    }
    if (op !== null) return json(400, { error: 'op' });

    const { deviceId, iv, data } = body;
    const compactionId = request.headers.get('compaction-id') ?? undefined;
    if (
      typeof deviceId !== 'string' ||
      !DEVICE.test(deviceId) ||
      typeof iv !== 'string' ||
      iv.length > 24 ||
      !BASE64.test(iv) ||
      typeof data !== 'string' ||
      !BASE64.test(data) ||
      (compactionId !== undefined && !LEASE.test(compactionId))
    ) {
      return json(400, { error: 'body' });
    }
    return answer(
      await store.push({
        space,
        authHash,
        deviceId,
        iv,
        data,
        limits: SYNC_LIMITS.space,
        ...(compactionId === undefined ? {} : { compactionId }),
      }),
    );
  }

  if (request.method === 'DELETE') {
    const result = await store.remove({ space, authHash });
    return 'denied' in result
      ? json(DENIED[result.denied], { error: result.denied })
      : json(200, { removed: true });
  }

  return json(405, { error: 'method' }, { allow: 'GET, POST, DELETE' });
}
