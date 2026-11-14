import type { SyncStore } from './store.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/**
 * 하루 한 번 Vercel Cron이 부르는 정리 (동기화 설계 §4.6): 1년 넘게 쓰지 않은 공간의 기록을 지우고
 * 「지움」 표시만 남긴다. Vercel은 프로젝트의 CRON_SECRET을 Authorization: Bearer로 실어 보내므로,
 * 그 값이 맞을 때만 한다 (CRON_SECRET이 없으면 하지 않는다)
 */
export async function handleCleanup(
  request: Request,
  store: SyncStore,
  secret: string | undefined,
): Promise<Response> {
  if (!secret) return json(503, { error: 'unavailable' });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json(401, { error: 'auth' });
  }
  const { spaces } = await store.sweep();
  return json(200, { removed: spaces });
}
