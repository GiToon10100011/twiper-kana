// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { levels } from '@twiper/content';
import '../../i18n';
import { accessFor } from './access';
import { CourseTiles } from './CourseTiles';
import { levelSymbol } from './levelTitle';

afterEach(cleanup);

const done = (bestAccuracy: number) => ({
  clearedAt: '2026-10-19T00:00:00.000Z',
  plays: 1,
  bestAccuracy,
  bestKpm: null,
});

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
  it('끝낸 레벨은 최고 기록, 이어서 할 레벨은 「이어서 하기」, 나머지는 잠김', () => {
    render(
      <MemoryRouter>
        <CourseTiles access={accessFor({ L1: done(0.98), L2: done(0.9) })} />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/train/L1',
      '/train/L2',
      '/train/L3',
    ]);
    expect(links[0]?.textContent).toContain('최고 98%');
    expect(links[2]?.getAttribute('aria-current')).toBe('step');
    expect(links[2]?.textContent).toContain('이어서 하기');
    expect(screen.getAllByText('잠김')).toHaveLength(levels.length - 3);
  });

  it('단계 탭은 이어서 할 레벨의 단계부터 보여 주고, 누르면 그 단계만 보여 준다', () => {
    const basic = levels.filter((level) => level.stage === 'basic').length;
    render(
      <MemoryRouter>
        <CourseTiles access={accessFor({}, true)} tabs />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(basic);

    fireEvent.click(screen.getByRole('button', { name: '조합' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(levels.length - basic);
    expect(screen.getByRole('button', { name: '조합' }).getAttribute('aria-pressed')).toBe('true');
  });
});
