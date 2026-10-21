// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { HomeLab, StepsLab } from './HomeLab';

afterEach(cleanup);

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/lab/home-v2" element={<HomeLab />} />
        <Route path="/lab/home-v2/steps" element={<StepsLab />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeLab (새 홈 시안)', () => {
  it('종합 테스트를 먼저 보여 주고, 그 아래 단계별 익히기로 이어서 할 레벨을 보여 준다', () => {
    renderAt('/lab/home-v2?state=midway');

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.slice(0, 2)).toEqual(['종합 테스트', '처음이라면']);
    expect(screen.getByText('Lv.4 た행 이어서 하기')).toBeTruthy();
  });

  it('A. 시험지형: 종목과 시간을 고르면 패널과 시작 버튼이 바뀌고, 시작하면 아직 만들기 전이라고 알려 준다', () => {
    renderAt('/lab/home-v2?state=allDone&layout=panel');
    const modes = screen.getByRole('group', { name: '종목' });
    expect(modes.querySelectorAll('button')).toHaveLength(4);
    expect(screen.getByRole('region', { name: '글자' })).toBeTruthy();
    expect(screen.getByText('12회')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '긴 글' }));
    fireEvent.click(screen.getByRole('button', { name: '3분' }));
    expect(screen.getByRole('region', { name: '긴 글' })).toBeTruthy();
    expect(screen.getByText('0회')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '3분 테스트 시작' }));
    expect(screen.getByRole('status').textContent).toMatch(/「긴 글」 3분 테스트는 아직/);
  });

  it('B. 기록판형: 종목마다 최고 속도를 보여 주고, 기록이 없으면 기록 없음', () => {
    renderAt('/lab/home-v2?state=allDone&layout=board');

    expect(screen.getByRole('button', { name: /^글자.*132/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^긴 글.*기록 없음/ })).toBeTruthy();
    cleanup();

    renderAt('/lab/home-v2?state=fresh&layout=board');
    expect(screen.getAllByText('기록 없음')).toHaveLength(4);
    expect(screen.getByText('튜토리얼부터 시작하기')).toBeTruthy();
  });

  it('다 끝냈으면 단계별 익히기는 강조 없이 끝냈다고 보여 준다', () => {
    renderAt('/lab/home-v2?state=allDone');

    expect(screen.getByText('17개 레벨 모두 끝냄')).toBeTruthy();
    expect(document.querySelector('.tile-item.is-current')).toBeNull();
  });

  it('단계별 익히기 시안은 튜토리얼과 코스 목록을 보여 준다', () => {
    renderAt('/lab/home-v2/steps?state=midway');

    expect(screen.getByRole('heading', { level: 1, name: '단계별 익히기' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /튜토리얼/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /た행/ }).getAttribute('aria-current')).toBe('step');
  });
});
