import { expect, test } from '@playwright/test';
import { playThrough } from './drill';

test('설정에서 속도 단위를 CPM으로 고르면 결과와 내 실력 추세의 속도가 CPM으로 보인다', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'CPM' }).click();

  await page.goto('/train/L1');
  await page.getByRole('button', { name: '시작' }).click();
  await playThrough(page);

  // 속도 칸이 CPM이고, 그 계산법을 함께 밝힌다
  await expect(page.getByRole('term').filter({ hasText: 'CPM' })).toBeVisible();
  await expect(page.getByRole('term').filter({ hasText: '가나/분' })).toHaveCount(0);
  await expect(
    page.getByText(/^CPM은 친 가나를 헤본식 로마자로 바꿔 1분에 친 글자 수로/),
  ).toBeVisible();

  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: '속도 (CPM)' })).toBeVisible();
});
