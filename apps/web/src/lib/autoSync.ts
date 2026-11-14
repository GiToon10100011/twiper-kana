import { trainingRepo } from './db';
import { loadSyncLink, runSync, type SyncRun } from './syncControl';

/** 자동 동기화 사이의 최소 간격 (동기화 설계 §4.5) */
export const AUTO_SYNC_GAP_MS = 30_000;

const SYNCED = 'twiper:synced';

let lastRequest = Number.NEGATIVE_INFINITY;

/** 한 번 주고받고, 결과를 열려 있는 화면(설정의 동기화 칸 등)에 알린다 */
export async function syncAndAnnounce(): Promise<SyncRun | null> {
  const result = await runSync(trainingRepo()).catch(() => null);
  window.dispatchEvent(new CustomEvent<SyncRun | null>(SYNCED, { detail: result }));
  return result;
}

/**
 * 앱을 열 때, 앱이 다시 앞으로 왔을 때, 연습 화면을 떠날 때 부른다. 꺼져 있거나 지난번에서 30초가 안 됐으면
 * 하지 않는다. now는 테스트용
 */
export function requestSync(now = Date.now()): void {
  if (!loadSyncLink() || now - lastRequest < AUTO_SYNC_GAP_MS) return;
  lastRequest = now;
  void syncAndAnnounce();
}

/** 동기화가 끝날 때마다 불린다. 그만 들으려면 돌려준 함수를 부른다 */
export function onSynced(listener: (result: SyncRun | null) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<SyncRun | null>).detail);
  window.addEventListener(SYNCED, handle);
  return () => window.removeEventListener(SYNCED, handle);
}
