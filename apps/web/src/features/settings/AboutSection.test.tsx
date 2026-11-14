// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { isDevMode, setDevMode } from '../../lib/flags';
import { AboutSection, DEV_MODE_TAP_GAP_MS, DEV_MODE_TAPS } from './AboutSection';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** 시계를 손으로 움직이는 AboutSection */
function renderAbout() {
  let clock = 1_000_000;
  render(<AboutSection now={() => clock} />);
  const version = () => screen.getByRole('button', { name: /버전/ });
  /** times번 누른다. 누름 사이는 gap ms */
  const tap = (times: number, gap = 200) => {
    for (let i = 0; i < times; i += 1) {
      clock += gap;
      fireEvent.click(version());
    }
  };
  return { version, tap };
}

describe('AboutSection (앱 정보)', () => {
  it('버전을 보여 준다', () => {
    const { version } = renderAbout();

    expect(screen.getByRole('heading', { name: '앱 정보' })).toBeTruthy();
    expect(version().textContent).toContain(__APP_VERSION__);
  });

  it('7번 잇달아 누르면 개발자 모드가 켜지고, 끝 3번은 남은 횟수를 알려 준다', () => {
    const { version, tap } = renderAbout();

    tap(3);
    expect(version().textContent).not.toMatch(/더 누르면/);
    tap(1);
    expect(screen.getByText('3번 더 누르면 개발자 모드가 켜져요.')).toBeTruthy();
    expect(isDevMode()).toBe(false);
    tap(DEV_MODE_TAPS - 4);

    expect(isDevMode()).toBe(true);
    expect(screen.getByText(/개발자 모드를 켰어요/)).toBeTruthy();
  });

  it('누름 사이가 길면 처음부터 다시 센다', () => {
    const { tap } = renderAbout();

    tap(DEV_MODE_TAPS - 1);
    tap(1, DEV_MODE_TAP_GAP_MS + 1);

    expect(isDevMode()).toBe(false);
  });

  it('저장하지 못하면 켜졌다고 하지 않고 그대로 둔다', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('사생활 보호 모드');
    });
    const { tap } = renderAbout();

    tap(DEV_MODE_TAPS);
    setItem.mockRestore();

    expect(isDevMode()).toBe(false);
    expect(screen.getByText('이 기기에 저장하지 못해 개발자 모드를 바꾸지 못했어요.')).toBeTruthy();
    expect(screen.queryByText(/개발자 모드를 켰어요/)).toBeNull();
  });

  it('켜져 있으면 그렇다고 알려 주고, 다시 7번 누르면 끈다', () => {
    setDevMode(true);
    const { tap } = renderAbout();

    expect(screen.getByText('개발자 모드가 켜져 있어요. 7번 누르면 꺼져요.')).toBeTruthy();
    tap(DEV_MODE_TAPS - 1);
    expect(screen.getByText('1번 더 누르면 개발자 모드가 꺼져요.')).toBeTruthy();
    tap(1);

    expect(isDevMode()).toBe(false);
    expect(screen.getByText('개발자 모드를 껐어요.')).toBeTruthy();
  });
});
