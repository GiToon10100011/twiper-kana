// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { Onboarding } from './Onboarding';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

async function typeAndCommit(input: HTMLInputElement, text: string) {
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.value = text;
  input.dispatchEvent(new CompositionEvent('compositionupdate', { data: text }));
  input.dispatchEvent(
    new InputEvent('input', { data: text, inputType: 'insertCompositionText', isComposing: true }),
  );
  await flush();
  input.dispatchEvent(new CompositionEvent('compositionend', { data: text }));
  await flush();
}

describe('튜토리얼', () => {
  it('준비 → 플릭 → あいうえお → 배치 → 방향 → きしちにひ → 다른 키 → 끝 순서로 진행한다', async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    expect(screen.getByText('1/8')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '준비했어요' }));
    fireEvent.click(screen.getByRole('button', { name: '직접 쳐 보기' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    await typeAndCommit(screen.getByRole('textbox'), 'あいうえお');

    expect(screen.getByRole('heading', { name: '12키는 50음 순서로 놓여 있어요' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '방향은 모음이에요' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '직접 쳐 보기' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(screen.getByText('6/8')).toBeTruthy();
    await typeAndCommit(screen.getByRole('textbox'), 'きしちにひ');

    expect(screen.getByRole('heading', { name: '키보드의 다른 키' })).toBeTruthy();
    expect(screen.getByText('7/8')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '준비 끝' })).toBeTruthy();
    expect(localStorage.getItem('twiper.onboarded')).toBe('1');
  });
});
