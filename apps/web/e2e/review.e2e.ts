import { expect, test } from '@playwright/test';
import { playThrough } from './drill';
import { attempt, backupFile } from './records';

test('이틀 전에 틀린 글자가 홈의 오늘 복습에 나오고, 복습 한 판을 끝내면 다음 복습으로 미뤄진다', async ({
  page,
}) => {
  // 이틀 전에 き와 さ를 틀렸다 → 어제가 복습 날이었다
  await page.goto('/settings');
  await page
    .getByLabel('파일 고르기')
    .setInputFiles(backupFile([attempt('A1', 2, 'かき', [1]), attempt('A2', 2, 'さし', [0])]));
  await expect(page.getByRole('status')).toContainText('2줄을 더했어요');

  await page.goto('/');
  const card = page.getByRole('link', { name: /^오늘 복습, 2글자, き, さ/ });
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.getByText(/며칠 전에 틀린 글자\(き・さ\)로 8줄을 쳐요/)).toBeVisible();
  await page.getByRole('button', { name: '시작' }).click();
  expect(await playThrough(page)).toBe(8);
  await expect(page.getByRole('heading', { name: '오늘 복습 끝' })).toBeVisible();

  // 오늘 맞혔으므로 다음 복습은 사흘 뒤다 (테스트와 브라우저는 같은 기기 시간대를 쓴다)
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  await page.goto('/');
  await expect(
    page.getByText(
      `오늘 복습할 글자는 없어요. 다음 복습 ${next.getMonth() + 1}월 ${next.getDate()}일 · 2글자`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /^오늘 복습/ })).toHaveCount(0);
});
