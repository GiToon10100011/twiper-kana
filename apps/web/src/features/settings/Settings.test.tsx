// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { loadSettings } from '../../lib/settings';
import { Settings } from './Settings';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Settings', () => {
  it('왼쪽 위 홈 버튼은 아이콘이고 이름은 「홈으로」다', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    const home = screen.getByRole('link', { name: '홈으로' });

    expect(home.getAttribute('href')).toBe('/');
    expect(home.textContent).toBe('');
    expect(home.querySelector('svg')).not.toBeNull();
  });

  it('「모든 레슨 열기」를 켜면 저장된다', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('switch', { name: /모든 레슨 열기/ }));

    expect(loadSettings().unlockAll).toBe(true);
  });
});
