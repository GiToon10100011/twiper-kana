// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleSync } from '../../../server/sync/handler';
import { createMemoryStore } from '../../../server/sync/store';
import '../../i18n';
import { AUTO_SYNC_GAP_MS, requestSync } from '../../lib/autoSync';
import { loadSyncLink } from '../../lib/syncControl';
import * as control from '../../lib/syncControl';
import { Settings } from './Settings';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** fetch를 메모리 저장소의 동기화 API로 바꿔 끼운다 */
const serveSync = () => {
  const store = createMemoryStore();
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) =>
    handleSync(new Request(new URL(input, 'https://twiper.test'), init), store),
  );
};

describe('설정의 기기 간 동기화', () => {
  it('켜면 새 코드를 펼쳐 보이고, 서버와 주고받아 마지막 동기화 때를 보인다', async () => {
    serveSync();
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '켜기' }));
    const code = loadSyncLink()?.code ?? '';
    expect(code).toHaveLength(26);
    expect(screen.getByLabelText('동기화 코드').textContent?.replace(/-/gu, '')).toBe(code);
    expect(await screen.findByText('방금 동기화했어요')).toBeTruthy();

    const turnOff = screen.getByText('이 기기에서 끄기').closest('.setting-row');
    if (!(turnOff instanceof HTMLElement)) throw new Error('끄기 줄이 없음');
    fireEvent.click(within(turnOff).getByRole('button', { name: '끄기' }));
    expect(loadSyncLink()).toBeNull();
    expect(screen.getByRole('button', { name: '켜기' })).toBeTruthy();
  });

  it('서버와 주고받지 못하면 목록 아래에 알린다', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '켜기' }));
    expect(await screen.findByText(/동기화하지 못했어요/u)).toBeTruthy();
  });
});

describe('requestSync', () => {
  it('꺼져 있으면 하지 않고, 켜져 있어도 30초 안에는 다시 하지 않는다', () => {
    const run = vi.spyOn(control, 'runSync').mockResolvedValue(null);
    requestSync(0);
    expect(run).not.toHaveBeenCalled();

    control.enableSync();
    requestSync(1_000_000);
    requestSync(1_000_000 + AUTO_SYNC_GAP_MS - 1);
    expect(run).toHaveBeenCalledTimes(1);
    requestSync(1_000_000 + AUTO_SYNC_GAP_MS);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
