import { expect, test } from '@playwright/test';

test('한 번 연 뒤에는 오프라인에서도 열리고 연습을 시작할 수 있다', async ({ page, context }) => {
  await page.goto('/steps');
  await expect(page.getByRole('heading', { name: '단계별 익히기' })).toBeVisible();
  // 서비스 워커가 앱 파일을 모두 내려받아 둘 때까지 기다린다
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '단계별 익히기' })).toBeVisible();

  await page.getByRole('link', { name: /Lv\.1/ }).click();
  await expect(page.getByRole('button', { name: '시작' })).toBeVisible();
});
