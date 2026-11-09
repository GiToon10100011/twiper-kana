// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attemptRecordOf,
  createInputSession,
  createMemoryRepo,
  type TrainingRepo,
} from '@twiper/core';
import '../../i18n';
import { loadProgress, recordLevel } from '../../lib/progress';
import { BackupSection } from './BackupSection';

afterEach(() => {
  cleanup();
  localStorage.clear();
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
});

/** jsdom에는 공유 API가 없으므로 iPhone처럼 파일을 공유할 수 있게 붙인다 */
const allowShare = (share: (data: ShareData) => Promise<void>) => {
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
};

/** IndexedDB처럼 다시 열어도 남는 저장소로 치는 메모리 저장소 */
const savedRepo = (): TrainingRepo => {
  const repo = createMemoryRepo();
  return {
    ...repo,
    mergeRecords: async (dump) => ({ ...(await repo.mergeRecords(dump)), persisted: true }),
  };
};

const attempt = (id: string) =>
  attemptRecordOf(createInputSession('か'), {
    id,
    sessionId: 'S',
    levelId: 'L1',
    shownAt: 0,
    at: new Date('2026-11-06T01:00:00.000Z'),
  });

const backupText = (attempts: unknown[]) =>
  JSON.stringify({
    format: 'twiper-backup',
    version: 1,
    exportedAt: '2026-11-06T02:00:00.000Z',
    progress: {
      L1: { clearedAt: '2026-11-01T00:00:00.000Z', plays: 2, bestAccuracy: 1, bestKpm: 30 },
    },
    exams: {},
    attempts,
    sessions: [],
  });

const choose = (text: string) =>
  fireEvent.change(screen.getByLabelText('파일 고르기'), {
    target: { files: [new File([text], 'backup.json', { type: 'application/json' })] },
  });

describe('BackupSection', () => {
  it('「파일로 저장」을 누르면 공유 창에 지금 기록을 담은 파일을 넘긴다', async () => {
    recordLevel('L1', { accuracy: 0.9, kpm: 40 });
    const repo = createMemoryRepo();
    await repo.saveAttempt(attempt('A1'));
    const share = vi.fn<(data: ShareData) => Promise<void>>(() => Promise.resolve());
    allowShare(share);
    render(<BackupSection repo={repo} />);

    const button = screen.getByRole<HTMLButtonElement>('button', { name: '파일로 저장' });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);

    expect(share).toHaveBeenCalledTimes(1);
    const file = share.mock.calls[0]?.[0].files?.[0];
    expect(file?.name).toMatch(/^twiper-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const saved = JSON.parse((await file?.text()) ?? '') as Record<string, unknown>;
    expect(saved).toMatchObject({ format: 'twiper-backup', version: 1 });
    expect(Object.keys(saved.progress as object)).toEqual(['L1']);
    expect((saved.attempts as { id: string }[]).map((a) => a.id)).toEqual(['A1']);
  });

  it('고른 파일을 지금 기록에 합치고 몇 줄을 더했는지 알린다. 같은 파일을 다시 고르면 더할 게 없다', async () => {
    const repo = savedRepo();
    render(<BackupSection repo={repo} />);

    choose(backupText([attempt('A1'), attempt('A2')]));
    expect(await screen.findByText(/연습 기록 2줄을 더했어요/)).toBeTruthy();
    expect(loadProgress().L1?.plays).toBe(2);
    expect((await repo.dumpRecords()).attempts.length).toBe(2);

    choose(backupText([attempt('A1'), attempt('A2')]));
    expect(await screen.findByText('이미 다 들어 있는 기록이에요.')).toBeTruthy();
    expect((await repo.dumpRecords()).attempts.length).toBe(2);
  });

  it('twiper 백업이 아닌 파일은 합치지 않고 경고한다', async () => {
    render(<BackupSection repo={createMemoryRepo()} />);

    choose('{"hello": "world"}');

    const status = await screen.findByText('twiper에서 내보낸 기록 파일이 아니에요.');
    expect(status.className).toContain('is-warning');
    expect(loadProgress()).toEqual({});
  });

  it('합친 기록이 기기에 남지 않으면(메모리 저장소) 다시 열면 사라질 수 있다고 경고한다', async () => {
    render(<BackupSection repo={createMemoryRepo()} />);

    choose(backupText([attempt('A1')]));

    const status = await screen.findByText(/이 기기에 저장하지 못했어요/);
    expect(status.className).toContain('is-warning');
  });
});
