// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRepo, type AttemptRecord, type TrainingRepo } from '@twiper/core';
import '../../i18n';
import { ReviewPractice } from './ReviewPractice';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** daysAgo일 전 낮에 끝낸 줄. missed는 플릭 실수한 자리 */
function line(daysAgo: number, target: string, missed: number[] = []): AttemptRecord {
  const now = new Date();
  const chars = Array.from(target);
  return {
    id: `P${daysAgo}${target}`,
    sessionId: 'S1',
    levelId: 'L2',
    at: new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12).toISOString(),
    target,
    input: target,
    result: missed.length === 0 ? 'correct' : 'corrected',
    judge: 'composing',
    reactionMs: null,
    elapsedMs: 1000,
    unitMs: chars.map(() => null),
    mistakes: missed.map((index) => ({
      index,
      expected: chars[index] ?? '',
      actual: 'さ',
      cause: 'continued',
      kind: 'key',
    })),
    corrections: missed.length,
    flags: [],
  };
}

const renderReview = (repo: TrainingRepo) =>
  render(
    <MemoryRouter initialEntries={['/review']}>
      <Routes>
        <Route path="/review" element={<ReviewPractice repo={repo} />} />
        <Route path="/" element={<p>홈</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ReviewPractice', () => {
  it('오늘 복습할 글자로 한 판을 준비하고, 그 글자를 안내한다', async () => {
    const repo = createMemoryRepo();
    // 이틀 전에 き를 틀렸으므로 어제가 예정일이었다
    await repo.saveAttempt(line(2, 'かき', [1]));
    renderReview(repo);
    await flush();

    expect(screen.getByRole('heading', { name: '오늘 복습' })).toBeTruthy();
    expect(screen.getByText(/며칠 전에 틀린 글자\(き\)로 8줄을 쳐요/)).toBeTruthy();
  });

  it('오늘 복습할 것이 없으면 홈으로 돌려보낸다', async () => {
    const repo = createMemoryRepo();
    // 오늘 틀린 글자는 내일 복습한다
    await repo.saveAttempt(line(0, 'かき', [1]));
    renderReview(repo);
    await flush();

    expect(screen.getByText('홈')).toBeTruthy();
  });
});
