// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRepo, type AttemptRecord, type TrainingRepo } from '@twiper/core';
import '../../i18n';
import { loadProgress } from '../../lib/progress';
import { WeakPractice } from './WeakPractice';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

let serial = 0;

/** 시도 기록 한 건. 모든 글자를 300ms에 쳤고 mistakes는 [위치, 친 글자] */
function attempt(target: string, mistakes: [number, string][] = []): AttemptRecord {
  serial += 1;
  const chars = Array.from(target);
  return {
    id: `W${String(serial).padStart(4, '0')}`,
    sessionId: 'S1',
    levelId: 'L2',
    at: new Date(Date.UTC(2026, 9, 26, 0, 0, serial)).toISOString(),
    target,
    input: target,
    result: mistakes.length === 0 ? 'correct' : 'corrected',
    judge: 'composing',
    reactionMs: null,
    elapsedMs: null,
    unitMs: chars.map(() => 300),
    mistakes: mistakes.map(([index, actual]) => ({
      index,
      expected: chars[index] ?? '',
      actual,
      cause: 'continued',
    })),
    corrections: mistakes.length,
    flags: [],
  };
}

const renderWeak = (repo: TrainingRepo) =>
  render(
    <MemoryRouter initialEntries={['/weak']}>
      <Routes>
        <Route path="/weak" element={<WeakPractice repo={repo} />} />
        <Route path="/stats" element={<p>내 실력 화면</p>} />
      </Routes>
    </MemoryRouter>,
  );

/** 지금 줄을 한 번의 조합으로 치고 確定한다 */
async function typeLine(line: string) {
  const input = screen.getByRole<HTMLInputElement>('textbox');
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.value = line;
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText' }));
  await flush();
  input.dispatchEvent(new CompositionEvent('compositionend', { data: line }));
  await flush();
}

describe('WeakPractice (/weak)', () => {
  it('최근 기록의 약점 글자로 한 판을 내고, 끝내도 레벨 진도에는 기록하지 않는다', async () => {
    const repo = createMemoryRepo();
    // き는 매번 け로 틀림
    for (let i = 0; i < 5; i += 1) await repo.saveAttempt(attempt('かきく', [[1, 'け']]));

    renderWeak(repo);

    // 연습 제목은 UI 언어(한국어)라서 일본어로 표시하지 않는다
    expect(
      (await screen.findByRole('heading', { name: '약점 연습' })).getAttribute('lang'),
    ).toBeNull();
    expect(screen.getByText(/자주 틀리거나 느린 글자\(き\)로 8줄을 쳐요/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    expect(document.querySelector('.target-text')?.textContent).toContain('き');

    for (let i = 0; i < 8; i += 1) {
      await typeLine(document.querySelector('.target-text')?.textContent ?? '');
    }

    expect(screen.getByRole('heading', { name: '약점 연습 끝' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '내 실력으로' }).getAttribute('href')).toBe('/stats');
    expect(screen.queryByRole('link', { name: /다음:/ })).toBeNull();
    expect(Object.keys(loadProgress())).toEqual([]);
  });

  it('약점이 없으면 내 실력으로 돌려보낸다', async () => {
    renderWeak(createMemoryRepo());

    expect(await screen.findByText('내 실력 화면')).toBeTruthy();
  });
});
