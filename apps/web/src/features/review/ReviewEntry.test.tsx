// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import type { ReviewPlan } from '../../lib/review';
import { ReviewEntry } from './ReviewEntry';

afterEach(cleanup);

const UNITS = ['ぎ', 'しゃ', 'っ', 'ぴ', 'る', 'ぢ', 'ほ', 'ぴゅ'];
const DUE: ReviewPlan = {
  due: UNITS.map((unit) => ({ unit, step: 0, due: '2026-11-10' })),
  dueCount: 9,
  next: null,
};
const LATER: ReviewPlan = { due: [], dueCount: 0, next: { day: '2026-11-12', count: 3 } };
const NONE: ReviewPlan = { due: [], dueCount: 0, next: null };

const renderEntry = (plan: ReviewPlan) =>
  render(
    <MemoryRouter>
      <ReviewEntry plan={plan} />
    </MemoryRouter>,
  );

describe('ReviewEntry', () => {
  it('카드 전체가 복습 링크이고, 모두 몇 글자인지와 한 판에 칠 글자를 읽어 주며, 시작 버튼은 칩 줄 끝에 있다', () => {
    renderEntry(DUE);
    const card = screen.getByRole('link');

    expect(card.getAttribute('href')).toBe('/review');
    expect(card.getAttribute('aria-label')).toBe(
      `오늘 복습, 9글자, ${UNITS.join(', ')}, 복습 시작`,
    );
    // 칩은 한 판에 칠 글자를 모두 넣고, 화면 폭에 들어가는 만큼만 보인다 (CSS)
    expect([...card.querySelectorAll('.review-chips > span')].map((c) => c.textContent)).toEqual(
      UNITS,
    );
    expect(card.querySelector('.review-card-row > .review-card-go')?.textContent).toBe('복습 시작');
  });

  it('오늘 복습할 것이 없으면 링크 없이 다음 복습 날만 알린다', () => {
    renderEntry(LATER);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('오늘 복습할 글자는 없어요. 다음 복습 11월 12일 · 3글자')).toBeTruthy();
  });

  it('틀린 적이 없어 복습할 것이 없으면 아무것도 보이지 않는다', () => {
    renderEntry(NONE);
    expect(document.body.textContent).toBe('');
  });
});
