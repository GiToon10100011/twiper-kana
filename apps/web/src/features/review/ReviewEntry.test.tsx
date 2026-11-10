// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import type { ReviewPlan } from '../../lib/review';
import { ReviewEntry, type ReviewLayout } from './ReviewEntry';

afterEach(cleanup);

const DUE: ReviewPlan = {
  due: [
    { unit: 'ぎ', step: 0, due: '2026-11-09' },
    { unit: 'しゃ', step: 1, due: '2026-11-10' },
  ],
  dueCount: 2,
  next: null,
};
const LATER: ReviewPlan = { due: [], dueCount: 0, next: { day: '2026-11-12', count: 3 } };
const NONE: ReviewPlan = { due: [], dueCount: 0, next: null };

const renderEntry = (plan: ReviewPlan, layout: ReviewLayout) =>
  render(
    <MemoryRouter>
      <ReviewEntry plan={plan} layout={layout} />
    </MemoryRouter>,
  );

describe('ReviewEntry', () => {
  it('카드: 오늘 복습할 글자와 복습 시작 링크를 보인다', () => {
    renderEntry(DUE, 'card');
    const card = screen.getByRole('region', { name: '오늘 복습' });

    expect(card.textContent).toContain('며칠 전에 틀린 글자 2개를 다시 쳐요');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['ぎ', 'しゃ']);
    expect(screen.getByRole('link', { name: '복습 시작' }).getAttribute('href')).toBe('/review');
  });

  it('카드: 오늘 복습할 것이 없으면 다음 복습 날을 알리고 시작 링크는 없다', () => {
    renderEntry(LATER, 'card');

    expect(screen.getByRole('region', { name: '오늘 복습' }).textContent).toContain(
      '오늘 복습할 글자는 없어요. 다음 복습 11월 12일 · 3글자',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('한 줄: 글자 수와 글자를 한 줄 링크로 보이고, 없으면 다음 복습 날만 보인다', () => {
    renderEntry(DUE, 'row');
    const row = screen.getByRole('link');
    expect(row.getAttribute('href')).toBe('/review');
    expect(row.textContent).toContain('오늘 복습2글자ぎ しゃ');
    cleanup();

    renderEntry(LATER, 'row');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('다음 복습 11월 12일 · 3글자')).toBeTruthy();
  });

  it('틀린 적이 없어 복습할 것이 없으면 아무것도 보이지 않는다', () => {
    renderEntry(NONE, 'card');
    expect(document.body.textContent).toBe('');
  });
});
