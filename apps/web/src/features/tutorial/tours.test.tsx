// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VowelTour } from './tours';

afterEach(cleanup);

const LEGEND = {
  tap: '탭 = あ단',
  left: '왼쪽 = い단',
  up: '위 = う단',
  right: '오른쪽 = え단',
  down: '아래 = お단',
};

describe('VowelTour', () => {
  it('방향을 고르면 그 단의 글자를 키 순서대로 보여 준다', () => {
    render(<VowelTour legend={LEGEND} label="방향은 모음" />);

    fireEvent.click(screen.getByRole('button', { name: '왼쪽 = い단' }));
    expect(screen.getByTestId('dan-row').textContent).toBe('い き し ち に ひ み り');

    fireEvent.click(screen.getByRole('button', { name: '위 = う단' }));
    expect(screen.getByTestId('dan-row').textContent).toBe('う く す つ ぬ ふ む ゆ る');

    fireEvent.click(screen.getByRole('button', { name: '아래 = お단' }));
    expect(screen.getByTestId('dan-row').textContent).toBe('お こ そ と の ほ も よ ろ');
  });

  it('규칙 밖의 글자(괄호·を·ん·ー)는 강조하지 않는다', () => {
    const { container } = render(<VowelTour legend={LEGEND} label="방향은 모음" />);

    fireEvent.click(screen.getByRole('button', { name: '오른쪽 = え단' }));
    const active = [...container.querySelectorAll('.kb-key.is-active')].map((el) => el.textContent);

    expect(active).toEqual(['え', 'け', 'せ', 'て', 'ね', 'へ', 'め', 'れ']);
    expect(screen.getByRole('button', { name: '오른쪽 = え단' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
