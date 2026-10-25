// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { iosKana } from '@twiper/content';
import { lookupChar } from '@twiper/core';
import '../../i18n';
import { HelpCard } from './HelpCard';

afterEach(cleanup);

const labels = { tap: '탭', left: '왼쪽', up: '위', right: '오른쪽', down: '아래' } as const;

const renderCard = (char: string) =>
  render(<HelpCard char={char} steps={lookupChar(iosKana, char) ?? []} labels={labels} />);

describe('HelpCard', () => {
  it('☆123 자판의 기호는 자판을 바꾸라는 표시와 그 자판의 키를 보여 준다', () => {
    renderCard('〜');
    const card = screen.getByRole('complementary', { name: '〜 치는 법' });

    expect(card.querySelector('.is-layer')?.textContent).toBe('☆123');
    expect(card.textContent).toContain('☆123 자판, 0 키 왼쪽');
  });

  it('かな 자판의 글자는 자판 표시 없이 키만 보여 준다', () => {
    renderCard('「');
    const card = screen.getByRole('complementary', { name: '「 치는 법' });

    expect(card.querySelector('.is-layer')).toBeNull();
    expect(card.textContent).toContain('や 키 왼쪽');
  });
});
