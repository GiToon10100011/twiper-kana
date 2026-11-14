import type { Denial, SpaceLimits, SyncStore } from './store';

/** 서버 한도 (동기화 설계 §4.6) */
export const SYNC_LIMITS = {
  /** 요청 본문 */
  maxRequestBytes: 512 * 1024,
  /** 한 번에 돌려주는 묶음 수 */
  maxPage: 50,
  space: { maxBytes: 20 * 1024 * 1024, pushesPerMinute: 60 } satisfies SpaceLimits,
} as const;

const SPACE = /^[0-9a-f]{32}$/u;
/** authKey는 32바이트 base64url (패딩 없이 43자) */
const AUTH = /^Bearer ([A-Za-z0-9_-]{43})$/u;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;
/** 기기 ID는 ULID */
const DEVICE = /^[0-9A-Z]{26}$/u;

const DENIED: Record<Denial, number> = { forbidden: 403, gone: 410, full: 507, rate: 429 };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const whole = (value: string | null, fallback: number) => {
  const n = Number(value ?? fallback);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 동기화 API (동기화 설계 §4.6). 공간은 주소의 space, 키는 Authorization: Bearer <authKey>로 받고,
 * 서버는 authKey의 SHA-256만 저장한다.
 * - GET    ?space=&after=&limit=  → { batches: [{ seq, deviceId, iv, data }] }
 * - POST   ?space=  { deviceId, iv, data } → { seq }
 * - DELETE ?space=  → { removed: true } (그 뒤 같은 코드의 요청은 410)
 */
export async function handleSync(request: Request, store: SyncStore): Promise<Response> {
  const url = new URL(request.url);
  const space = url.searchParams.get('space') ?? '';
  if (!SPACE.test(space)) return json(400, { error: 'space' });
  const key = AUTH.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!key) return json(401, { error: 'auth' });
  const authHash = await sha256Hex(key);

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
      : json(200, { batches: result.batches });
  }

  if (request.method === 'POST') {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > SYNC_LIMITS.maxRequestBytes) return json(413, { error: 'size' });
    const text = await request.text();
    if (text.length > SYNC_LIMITS.maxRequestBytes) return json(413, { error: 'size' });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: 'body' });
    }
    const { deviceId, iv, data } = (body ?? {}) as Record<string, unknown>;
    if (
      typeof deviceId !== 'string' ||
      !DEVICE.test(deviceId) ||
      typeof iv !== 'string' ||
      iv.length > 24 ||
      !BASE64.test(iv) ||
      typeof data !== 'string' ||
      !BASE64.test(data)
    ) {
      return json(400, { error: 'body' });
    }
    const result = await store.push({
      space,
      authHash,
      deviceId,
      iv,
      data,
      limits: SYNC_LIMITS.space,
    });
    return 'denied' in result
      ? json(DENIED[result.denied], { error: result.denied })
      : json(200, { seq: result.seq });
  }

  if (request.method === 'DELETE') {
    const result = await store.remove({ space, authHash });
    return 'denied' in result
      ? json(DENIED[result.denied], { error: result.denied })
      : json(200, { removed: true });
  }

  return json(405, { error: 'method' }, { allow: 'GET, POST, DELETE' });
}
