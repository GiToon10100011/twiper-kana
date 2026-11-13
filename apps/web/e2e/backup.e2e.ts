import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { attempt, backupFile } from './records';

test.beforeEach(async ({ page }) => {
  // 공유 창은 브라우저마다 달라 쓰지 않고, 앱이 대신 쓰는 내려받기로 파일을 받는다
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined });
    Object.defineProperty(Navigator.prototype, 'canShare', {
      configurable: true,
      value: undefined,
    });
  });
});

test('백업 파일을 가져오면 진도와 기록이 합쳐지고, 파일로 저장하면 그 기록이 담긴다', async ({
  page,
}) => {
  const attempts = [
    attempt('A1', 2, 'かき', [1]),
    attempt('A2', 2, 'さし'),
    attempt('A3', 1, 'たち'),
  ];
  await page.goto('/settings');
  await page.getByLabel('파일 고르기').setInputFiles(backupFile(attempts));
  await expect(page.getByRole('status')).toHaveText(
    '연습 기록 3줄을 더했어요. 진도와 최고 기록도 합쳤어요.',
  );

  // 같은 파일을 다시 가져와도 늘지 않는다
  await page.getByLabel('파일 고르기').setInputFiles(backupFile(attempts));
  await expect(page.getByRole('status')).toHaveText('이미 다 들어 있는 기록이에요.');

  // 가져온 진도로 Lv.2가 열린다
  await page.goto('/steps');
  await expect(page.getByRole('link', { name: /Lv\.2/ })).toBeVisible();

  // 다시 열어 새로 만든 파일을 내려받는다
  await page.goto('/settings');
  const save = page.getByRole('button', { name: '파일로 저장' });
  await expect(save).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toMatch(/^twiper-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = JSON.parse(await readFile(await download.path(), 'utf8')) as {
    format: string;
    progress: Record<string, unknown>;
    attempts: { id: string }[];
  };
  expect(saved.format).toBe('twiper-backup');
  expect(Object.keys(saved.progress)).toEqual(['L1']);
  expect(saved.attempts.map((a) => a.id)).toEqual(['A1', 'A2', 'A3']);
});
