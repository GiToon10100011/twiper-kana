import { expect, test } from '@playwright/test';
import { typeKana } from './ime';

test('글자 1분 테스트를 치고 시간이 끝나면 결과가 나오고, 홈에 응시 기록이 남는다', async ({
  page,
}) => {
  // 1분을 실제로 기다리지 않도록 시계를 넘길 수 있게 한다 (시험은 performance.now·setTimeout으로 잰다)
  await page.clock.install();
  await page.goto('/test/kana?min=1&seed=7');

  // 처음에는 주의사항 창이 저절로 열린다. 닫으면 입력창으로 간다
  await page.getByRole('button', { name: '알겠어요' }).click();
  for (let line = 0; line < 2; line += 1) {
    const target = (await page.locator('.target-text').innerText()).replace(/\s/gu, '');
    await typeKana(page, target);
    await expect(page.locator('.target-text')).not.toHaveText(target);
  }

  await page.clock.fastForward('01:01');
  await expect(page.getByRole('heading', { name: /글자 테스트 끝/ })).toBeVisible();
  await expect(page.getByText('2줄')).toBeVisible();
  await expect(page.getByText('최고 기록이에요!')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('1회')).toBeVisible();
});
