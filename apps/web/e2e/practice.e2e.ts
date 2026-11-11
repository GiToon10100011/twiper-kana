import { expect, test } from '@playwright/test';
import { typeKana } from './ime';

test('Lv.1을 끝까지 치면 결과가 나오고, 다시 열어도 진도와 기록이 남는다', async ({ page }) => {
  await page.goto('/train/L1');
  await page.getByRole('button', { name: '시작' }).click();

  const result = page.getByRole('heading', { name: /끝$/ });
  const progress = page.locator('.screen-header > span');
  // 줄마다 화면의 목표를 읽어 그대로 친다. 틀리지 않으므로 다시 나오는 줄 없이 8줄로 끝난다
  let typed = 0;
  for (let line = 1; line <= 20 && !(await result.isVisible()); line += 1) {
    const before = await progress.textContent();
    const target = (await page.locator('.target-text').innerText()).replace(/\s/gu, '');
    await typeKana(page, target);
    typed += 1;
    await expect(async () => {
      expect((await result.isVisible()) || (await progress.textContent()) !== before).toBe(true);
    }).toPass();
  }

  await expect(result).toBeVisible();
  expect(typed).toBe(8);
  await expect(page.getByText('100%').first()).toBeVisible();
  await expect(page.getByText('한 번도 틀리지 않았어요.')).toBeVisible();

  // 다시 열어도 진도(localStorage)와 시도 기록(IndexedDB)이 남는다
  await page.goto('/steps');
  await page.reload();
  await expect(page.getByRole('link', { name: /Lv\.2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Lv\.3/ })).toHaveCount(0);

  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: '규칙별 실력' })).toBeVisible();
  await expect(page.getByText('あ행')).toBeVisible();
});
