import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { handleSync } from '../server/sync/handler';
import { createMemoryStore, type SyncStore } from '../server/sync/store';
import { playThrough } from './drill';

// 서비스 워커가 요청을 가로채면 아래의 /api/sync 바꿔 끼우기가 닿지 않는다
test.use({ serviceWorkers: 'block' });

/** 미리보기 서버에는 API가 없으므로, /api/sync를 메모리 저장소의 동기화 API 처리부로 받는다 */
async function serveSync(context: BrowserContext, store: SyncStore) {
  await context.route('**/api/sync**', async (route) => {
    const request = route.request();
    const body = request.postDataBuffer();
    const response = await handleSync(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: body ? new Uint8Array(body) : undefined,
      }),
      store,
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

const synced = (page: Page) => expect(page.getByText('방금 동기화했어요')).toBeVisible();

test('두 기기가 같은 코드로 진도와 설정을 주고받는다', async ({ browser }) => {
  const store = createMemoryStore();
  // 브라우저 문맥마다 저장소가 따로라 기기 두 대와 같다
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await serveSync(contextA, store);
  await serveSync(contextB, store);
  const a = await contextA.newPage();
  const b = await contextB.newPage();

  // 기기 A: Lv.1을 끝내고 속도 단위를 CPM으로 바꾼 뒤 동기화를 켠다
  await a.goto('/train/L1');
  await a.getByRole('button', { name: '시작' }).click();
  await playThrough(a);
  await a.goto('/settings');
  await a.getByRole('button', { name: 'CPM' }).click();
  await a.getByRole('button', { name: '켜기' }).click();
  await synced(a);
  const code = (await a.getByLabel('동기화 코드').textContent()) ?? '';
  expect(code.replace(/-/gu, '')).toHaveLength(26);

  // 기기 B: 코드를 넣으면 A의 진도와 설정을 받는다
  await b.goto('/settings');
  await b.getByRole('button', { name: '넣기' }).click();
  await b.getByRole('textbox', { name: '동기화 코드' }).fill(code.toLowerCase());
  await b.getByRole('button', { name: '연결' }).click();
  await synced(b);
  await expect(b.getByRole('button', { name: 'CPM' })).toHaveAttribute('aria-pressed', 'true');
  await b.goto('/steps');
  await expect(b.getByRole('link', { name: /Lv\.2/ })).toBeVisible();

  // B에서 모든 레슨 열기를 켜고 동기화하면, A를 다시 열 때 받는다
  await b.goto('/settings');
  await b.getByRole('switch', { name: /모든 레슨/ }).check();
  await b.getByRole('button', { name: '지금 동기화' }).click();
  await synced(b);
  await a.goto('/settings');
  await expect(a.getByRole('switch', { name: /모든 레슨/ })).toBeChecked();

  await contextA.close();
  await contextB.close();
});
