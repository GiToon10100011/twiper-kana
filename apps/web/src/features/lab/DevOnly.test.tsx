// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { setDevMode } from '../../lib/flags';
import { DevOnly } from './DevOnly';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>홈</p>} />
        <Route element={<DevOnly />}>
          <Route path="/lab/sync" element={<p>동기화 시안</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('DevOnly (개발 도구 경로)', () => {
  it('개발자 모드가 꺼져 있으면 /lab 주소로 들어와도 홈으로 돌려보낸다', () => {
    renderAt('/lab/sync');

    expect(screen.getByText('홈')).toBeTruthy();
    expect(screen.queryByText('동기화 시안')).toBeNull();
  });

  it('개발자 모드가 켜져 있으면 그 화면을 보여 준다', () => {
    setDevMode(true);
    renderAt('/lab/sync');

    expect(screen.getByText('동기화 시안')).toBeTruthy();
  });
});
