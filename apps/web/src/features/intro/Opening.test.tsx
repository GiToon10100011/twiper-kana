// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { Opening } from './Opening';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Opening', () => {
  it('워드마크를 다 쓰고 2초 안에 끝난다', () => {
    const onFinish = vi.fn();
    render(<Opening onFinish={onFinish} />);

    act(() => vi.advanceTimersByTime(1500));
    expect(onFinish).not.toHaveBeenCalled();

    // 사라지기 시작한 뒤(1.6초) 페이드 타이머가 걸리므로 단계를 나눠 넘긴다.
    act(() => vi.advanceTimersByTime(200));
    act(() => vi.advanceTimersByTime(300));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('누르면 바로 넘어간다', () => {
    const onFinish = vi.fn();
    render(<Opening onFinish={onFinish} />);

    fireEvent.pointerDown(screen.getByTestId('opening'));
    act(() => vi.advanceTimersByTime(300));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
