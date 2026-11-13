import { expect, test } from '@playwright/test';
import { playThrough } from './drill';

test('Lv.1을 끝까지 치면 결과가 나오고, 다시 열어도 진도와 기록이 남는다', async ({ page }) => {
  await page.goto('/train/L1');
  await page.getByRole('button', { name: '시작' }).click();

  // 틀리지 않으므로 다시 나오는 줄 없이 8줄로 끝난다
  expect(await playThrough(page)).toBe(8);
  await expect(page.getByText('100%').first()).toBeVisible();
  await expect(page.getByText('한 번도 틀리지 않았어요.')).toBeVisible();
  // 기본 속도 단위는 가나/분이라 계산법 줄은 없다
  await expect(page.getByRole('term').filter({ hasText: '가나/분' })).toBeVisible();
  await expect(page.getByText(/헤본식 로마자/)).toHaveCount(0);

  // 다시 열어도 진도(localStorage)와 시도 기록(IndexedDB)이 남는다
  await page.goto('/steps');
  await page.reload();
  await expect(page.getByRole('link', { name: /Lv\.2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Lv\.3/ })).toHaveCount(0);

  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: '규칙별 실력' })).toBeVisible();
  await expect(page.getByText('あ행')).toBeVisible();
});
