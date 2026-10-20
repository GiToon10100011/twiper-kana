// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { levels } from '@twiper/content';
import '../../i18n';
import { recordLevel } from '../../lib/progress';
import { saveSettings } from '../../lib/settings';
import { accessFor, levelAccess, type LevelAccess } from './access';
import { CourseTiles } from './CourseTiles';
import { DrillRoute } from './Drill';
import { levelSymbol } from './levelTitle';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const done = (bestAccuracy: number) => ({
  clearedAt: '2026-10-19T00:00:00.000Z',
  plays: 1,
  bestAccuracy,
  bestKpm: null,
});

const BASIC = levels.filter((level) => level.stage === 'basic').length;

const renderTiles = (access: LevelAccess = levelAccess()) =>
  render(
    <MemoryRouter>
      <CourseTiles access={access} />
    </MemoryRouter>,
  );

const hrefs = () => screen.queryAllByRole('link').map((link) => link.getAttribute('href'));
const current = () => screen.queryAllByRole('link').filter((l) => l.getAttribute('aria-current'));

describe('levelSymbol', () => {
  it('행 레벨은 키 글자, 50음은 「50音」, 조합은 대표 글자', () => {
    const symbol = (id: string) => levelSymbol(levels.find((level) => level.id === id)!);

    expect(['L1', 'L2', 'L9', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15'].map(symbol)).toEqual([
      'あ',
      'か',
      'らわ',
      '50音',
      'が',
      'ぱ',
      'ぁ',
      'きゃ',
      'っ',
    ]);
  });
});

describe('CourseTiles', () => {
  it('처음에는 기초 단계에서 Lv.1만 열려 있고 「이어서 하기」로 강조한다', () => {
    renderTiles();

    expect(hrefs()).toEqual(['/train/L1']);
    expect(current()[0]?.textContent).toContain('이어서 하기');
    expect(screen.getAllByText('잠김')).toHaveLength(BASIC - 1);
  });

  it('끝낸 레벨은 최고 기록을 보여 주고 다음 레벨이 열린다', () => {
    recordLevel('L1', { accuracy: 0.96, kpm: 40 });
    renderTiles();

    expect(hrefs()).toEqual(['/train/L1', '/train/L2']);
    expect(screen.getByText('최고 96%')).toBeTruthy();
    expect(current().map((link) => link.getAttribute('href'))).toEqual(['/train/L2']);
  });

  it('앞 레벨을 다시 해도 강조는 최고 진도(가장 뒤에 끝낸 레벨의 다음)에 있다', () => {
    renderTiles(accessFor({ L1: done(0.98), L2: done(0.9), L3: done(0.9) }));

    expect(current().map((link) => link.getAttribute('href'))).toEqual(['/train/L4']);
  });

  it('최고 진도가 조합 단계면 조합 탭부터 보여 준다', () => {
    renderTiles(accessFor({ L10: done(0.95) }, true));

    expect(screen.getByRole('button', { name: '조합' }).getAttribute('aria-pressed')).toBe('true');
    expect(current().map((link) => link.getAttribute('href'))).toEqual(['/train/L11']);
  });

  it('탭을 누르면 그 단계의 레벨만 보여 준다', () => {
    renderTiles(accessFor({}, true));

    expect(screen.getAllByRole('listitem')).toHaveLength(BASIC);

    fireEvent.click(screen.getByRole('button', { name: '조합' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(levels.length - BASIC);
  });

  it('설정에서 모두 열기를 켜면 모든 레벨이 열린다', () => {
    saveSettings({ unlockAll: true });
    renderTiles();
    const basic = hrefs().length;
    fireEvent.click(screen.getByRole('button', { name: '조합' }));

    expect(basic + hrefs().length).toBe(levels.length);
  });

  it('마지막 레벨까지 끝냈으면 강조하지 않는다', () => {
    renderTiles(accessFor(Object.fromEntries(levels.map((level) => [level.id, done(0.9)]))));

    expect(current()).toEqual([]);
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
