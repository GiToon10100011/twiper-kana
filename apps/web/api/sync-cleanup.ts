import { neon } from '@neondatabase/serverless';
// Vercel Function은 ESM으로 돌므로 상대 경로에 .js를 붙인다 (빌드가 .ts를 .js로 바꾼다)
import { handleCleanup } from '../server/sync/cleanup.js';
import { createNeonStore } from '../server/sync/neonStore.js';

/** 1년 넘게 쓰지 않은 동기화 공간을 지우는 예약 작업 (vercel.json crons, 하루 한 번) */
export function GET(request: Request): Promise<Response> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Promise.resolve(
      new Response(JSON.stringify({ error: 'unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }
  return handleCleanup(request, createNeonStore(neon(url)), process.env.CRON_SECRET);
}
