import { expect, test } from '@playwright/test';

test('설정에서 English를 고르면 그 자리에서 바뀌고, 다시 열어도 영어다', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/steps');
  await expect(page.getByRole('heading', { name: 'Step-by-step lessons' })).toBeVisible();
});
