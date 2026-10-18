// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { recordLevel } from '../../lib/progress';
import { saveSettings } from '../../lib/settings';
import { levelAccess } from './access';
import { CourseList } from './CourseList';
import { DrillRoute } from './Drill';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const renderList = () =>
  render(
    <MemoryRouter>
      <CourseList access={levelAccess()} />
    </MemoryRouter>,
  );

const levelLinks = () => screen.queryAllByRole('link').map((link) => link.getAttribute('href'));

describe('CourseList', () => {
  it('처음에는 Lv.1만 열려 있고 이어서 할 레벨로 표시한다', () => {
    renderList();

    expect(levelLinks()).toEqual(['/train/L1']);
    expect(screen.getByRole('link').getAttribute('aria-current')).toBe('step');
    expect(screen.getAllByLabelText(/잠김$/)).toHaveLength(9);
  });

  it('끝낸 레벨은 최고 정확도를 보여 주고 다음 레벨이 열린다', () => {
    recordLevel('L1', { accuracy: 0.96, kpm: 40 });
    renderList();

    expect(levelLinks()).toEqual(['/train/L1', '/train/L2']);
    expect(screen.getByText('최고 96%')).toBeTruthy();
  });

  it('설정에서 모두 열기를 켜면 10개 레벨이 모두 열린다', () => {
    saveSettings({ unlockAll: true });
    renderList();

    expect(levelLinks()).toHaveLength(10);
  });
});

describe('DrillRoute', () => {
  const renderRoute = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>홈 화면</p>} />
          <Route path="/train/:levelId" element={<DrillRoute />} />
        </Routes>
      </MemoryRouter>,
    );

  it('잠긴 레벨 주소로 들어오면 홈으로 보낸다', () => {
    renderRoute('/train/L3');

    expect(screen.getByText('홈 화면')).toBeTruthy();
  });

  it('열린 레벨은 준비 화면을 보여 준다', () => {
    renderRoute('/train/L1');

    expect(screen.getByRole('button', { name: '시작' })).toBeTruthy();
  });
});
