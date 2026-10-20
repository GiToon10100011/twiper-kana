// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AttemptRecord } from '@twiper/core';
import '../../i18n';
import { trainingRepo } from '../../lib/db';
import { Stats } from './Stats';

afterEach(cleanup);

let serial = 0;

/** 시도 기록 한 건. 모든 글자를 300ms에 쳤고 mistakes는 [위치, 친 글자] */
function attempt(target: string, mistakes: [number, string][] = []): AttemptRecord {
  serial += 1;
  const chars = Array.from(target);
  return {
    id: `A${String(serial).padStart(4, '0')}`,
    sessionId: 'S1',
    levelId: 'L1',
    at: new Date(Date.UTC(2026, 9, 21, 0, 0, serial)).toISOString(),
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

const renderStats = () =>
  render(
    <MemoryRouter>
      <Stats />
    </MemoryRouter>,
  );

describe('Stats', () => {
  it('기록이 없으면 레벨을 끝내면 보인다고 알려 준다', async () => {
    renderStats();

    expect(await screen.findByText(/아직 기록이 없어요/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '홈으로' })).toBeTruthy();
  });

  it('규칙마다 정확도와 글자당 시간을, 표본이 적으면 측정 중으로 보여 준다', async () => {
    const repo = trainingRepo();
    // あ행 10줄(50글자) 중 え를 한 번 う로 틀림, 탁음은 한 줄(2글자)
    for (let i = 0; i < 10; i += 1) {
      await repo.saveAttempt(attempt('あいうえお', i === 0 ? [[3, 'う']] : []));
    }
    await repo.saveAttempt(attempt('がぎ'));

    renderStats();

    const aRow = await screen.findByRole('meter', { name: 'あ행' });
    // 최근 60번까지라 50글자 모두, 49/50 = 98%
    expect(aRow.getAttribute('aria-valuenow')).toBe('98');
    expect(screen.getAllByText('글자당 0.3초').length).toBeGreaterThan(0);
    expect(screen.getByRole('meter', { name: '탁음 が' }).getAttribute('aria-valuetext')).toBe(
      '측정 중',
    );
    expect(screen.getByText('측정 중 2/8')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '기초' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '조합' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '가타카나' })).toBeNull();
    expect(screen.getByLabelText('え 자리에 う, 1번')).toBeTruthy();
  });
});
