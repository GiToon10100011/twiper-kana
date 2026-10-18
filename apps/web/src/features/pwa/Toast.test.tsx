// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast';

afterEach(cleanup);

describe('Toast', () => {
  it('주 동작과 닫기를 따로 부른다', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <Toast
        message="새 버전이 있어요."
        action={{ label: '업데이트', onClick }}
        closeLabel="닫기"
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('새 버전이 있어요.');

    fireEvent.click(screen.getByRole('button', { name: '업데이트' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('동작이 없으면 닫기 버튼만 있다', () => {
    render(<Toast message="오프라인 준비" closeLabel="닫기" onClose={() => {}} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
