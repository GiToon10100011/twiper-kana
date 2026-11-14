import { neon } from '@neondatabase/serverless';
// Vercel Function은 ESM으로 돌므로 상대 경로에 .js를 붙인다 (빌드가 .ts를 .js로 바꾼다)
import { handleSync } from '../server/sync/handler.js';
import { createNeonStore } from '../server/sync/neonStore.js';
import type { SyncStore } from '../server/sync/store.js';

let store: SyncStore | null = null;

/**
 * 동기화 API (Vercel Function, 동기화 설계 §4.6). 접속 정보는 Vercel에 연결한 Neon이 넣어 준 DATABASE_URL.
 * 처리는 server/sync/handler에서 한다
 */
function handle(request: Request): Promise<Response> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Promise.resolve(
      new Response(JSON.stringify({ error: 'unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }
  store ??= createNeonStore(neon(url));
  return handleSync(request, store);
}

export { handle as DELETE, handle as GET, handle as POST };
