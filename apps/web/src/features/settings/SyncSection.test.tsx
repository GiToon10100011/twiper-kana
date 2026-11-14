// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { SyncSection, type SyncActions, type SyncPanel } from './SyncSection';

afterEach(cleanup);

const CODE = 'ZFH0B0R7BRFQ4X6475FE54MK10';
const NOW = Date.UTC(2026, 10, 14, 12, 0);

const actionsMock = () =>
  ({
    enable: vi.fn<() => void>(),
    startJoin: vi.fn<() => void>(),
    join: vi.fn<(input: string) => void>(),
    cancelJoin: vi.fn<() => void>(),
    syncNow: vi.fn<() => void>(),
    copy: vi.fn<(code: string) => Promise<void>>(() => Promise.resolve()),
    turnOff: vi.fn<() => void>(),
    remove: vi.fn<() => void>(),
  }) satisfies SyncActions;

const on = (overrides: Partial<Extract<SyncPanel, { kind: 'on' }>> = {}): SyncPanel => ({
  kind: 'on',
  code: CODE,
  syncedAt: NOW - 3 * 60_000,
  syncing: false,
  created: false,
  problem: null,
  ...overrides,
});

describe('SyncSection', () => {
  it('꺼져 있으면 켜기와 코드 넣기를 보이고, 코드를 넣어 연결한다', () => {
    const actions = actionsMock();
    const { rerender } = render(
      <SyncSection panel={{ kind: 'off' }} actions={actions} now={NOW} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '켜기' }));
    expect(actions.enable).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '넣기' }));
    expect(actions.startJoin).toHaveBeenCalled();

    rerender(<SyncSection panel={{ kind: 'join', invalid: true }} actions={actions} now={NOW} />);
    expect(screen.getByText(/코드가 맞지 않아요/u)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '동기화 코드' }), {
      target: { value: 'zfh0-b0r7' },
    });
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    expect(actions.join).toHaveBeenCalledWith('zfh0-b0r7');
  });

  it('켜져 있으면 마지막 동기화 때를 보이고, 코드는 가렸다가 보기를 누르면 4자씩 끊어 보인다', () => {
    render(<SyncSection panel={on()} actions={actionsMock()} now={NOW} />);

    expect(screen.getByText('3분 전에 동기화했어요')).toBeTruthy();
    const code = screen.getByLabelText('동기화 코드');
    expect(code.textContent).not.toContain('ZFH0');
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(code.textContent).toBe('ZFH0-B0R7-BRFQ-4X64-75FE-54MK-10');
  });

  it('방금 만든 코드는 펼쳐 두고, 복사하면 「복사했어요」로 바뀐다', async () => {
    const actions = actionsMock();
    render(<SyncSection panel={on({ created: true })} actions={actions} now={NOW} />);

    expect(screen.getByLabelText('동기화 코드').textContent).toContain('ZFH0');
    fireEvent.click(screen.getByRole('button', { name: '복사' }));
    expect(actions.copy).toHaveBeenCalledWith(CODE);
    expect(await screen.findByRole('button', { name: '복사했어요' })).toBeTruthy();
  });

  it('서버의 기록 지우기는 한 번 더 묻고, 동기화 중에는 지금 동기화를 누를 수 없다', () => {
    const actions = actionsMock();
    render(<SyncSection panel={on({ syncing: true })} actions={actions} now={NOW} />);

    expect(
      (screen.getByRole('button', { name: '지금 동기화' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(actions.remove).not.toHaveBeenCalled();
    expect(screen.getByText('정말 지울까요? 되돌릴 수 없어요.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(actions.remove).toHaveBeenCalled();
  });

  it('문제가 있으면 목록 아래에 알린다', () => {
    const { rerender } = render(
      <SyncSection panel={on({ problem: 'update' })} actions={actionsMock()} now={NOW} />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/업데이트/u);

    rerender(
      <SyncSection panel={{ kind: 'off', problem: 'gone' }} actions={actionsMock()} now={NOW} />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/새 코드를 만드세요/u);
  });

  it('복사하지 못하면 「복사했어요」 대신 직접 복사하라고 알리고 코드를 펼친다', async () => {
    const actions = actionsMock();
    actions.copy.mockRejectedValue(new Error('denied'));
    render(<SyncSection panel={on()} actions={actions} now={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: '복사' }));
    expect(await screen.findByText(/복사하지 못했어요/u)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '복사했어요' })).toBeNull();
    expect(screen.getByLabelText('동기화 코드').textContent).toContain('ZFH0');
  });
});
