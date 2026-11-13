import { expect, type Page } from '@playwright/test';
import { typeKana } from './ime';

/**
 * 시작한 줄 연습을 끝까지 친다: 줄마다 화면의 목표를 읽어 그대로 치고, 머리의 진행(3/8)이 바뀌거나
 * 결과 화면이 나올 때까지 기다린다. 틀리지 않으므로 다시 나오는 줄이 없다. 친 줄 수를 돌려준다
 */
export async function playThrough(page: Page): Promise<number> {
  const result = page.getByRole('heading', { name: /끝$/ });
  const progress = page.locator('.screen-header > span');
  let typed = 0;
  while (typed < 20 && !(await result.isVisible())) {
    const before = await progress.textContent();
    const target = (await page.locator('.target-text').innerText()).replace(/\s/gu, '');
    await typeKana(page, target);
    typed += 1;
    await expect(async () => {
      expect((await result.isVisible()) || (await progress.textContent()) !== before).toBe(true);
    }).toPass();
  }
  await expect(result).toBeVisible();
  return typed;
}
