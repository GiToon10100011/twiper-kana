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
  it('종합 테스트 4종을 먼저 보여 주고, 그 아래 단계별 익히기로 이어서 할 레벨을 보여 준다', () => {
    renderAt('/lab/home-v2?state=midway');

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.slice(0, 2)).toEqual(['종합 테스트', '처음이라면']);
    for (const name of ['글자', '단어', '짧은 글', '긴 글']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeTruthy();
    }
    expect(screen.getByText('Lv.4 た행 이어서 하기')).toBeTruthy();
  });

  it('처음이면 튜토리얼부터, 다 끝냈으면 끝냈다고 보여 주고 테스트 기록을 보인다', () => {
    renderAt('/lab/home-v2?state=fresh');
    expect(screen.getByText('튜토리얼부터 시작하기')).toBeTruthy();
    expect(screen.getAllByText('기록 없음')).toHaveLength(4);
    cleanup();

    renderAt('/lab/home-v2?state=allDone&layout=list');
    expect(screen.getByText('17개 레벨 모두 끝냄')).toBeTruthy();
    expect(screen.getByText('최고 132가나/분 · 97%')).toBeTruthy();
  });

  it('테스트를 누르면 아직 만들기 전이라고 알려 준다', () => {
    renderAt('/lab/home-v2');
    fireEvent.click(screen.getByRole('button', { name: /^긴 글/ }));

    expect(screen.getByRole('status').textContent).toMatch(/「긴 글」 테스트는 아직/);
  });

  it('단계별 익히기 시안은 튜토리얼과 코스 목록을 보여 준다', () => {
    renderAt('/lab/home-v2/steps?state=midway');

    expect(screen.getByRole('heading', { level: 1, name: '단계별 익히기' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /튜토리얼/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /た행/ }).getAttribute('aria-current')).toBe('step');
  });
});
