// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { KeyboardKeys } from './KeyboardKeys';

afterEach(cleanup);

const keyboard = () => screen.getByRole('group', { name: '일본어 かな 키보드' });
const explain = () => screen.getByRole('region', { name: '키 설명' });

describe('KeyboardKeys (키보드의 다른 키)', () => {
  it('기본은 「フリックのみ」를 끈 배치로, 왼쪽 줄에 → ↺ ABC 이모지가 있고 → 설명부터 보여 준다', () => {
    render(<KeyboardKeys />);
    const keys = within(keyboard());

    for (const name of ['→ (문자 보내기)', '↺ (거꾸로)', 'ABC (영문)', '이모지']) {
      expect(keys.getByRole('button', { name })).toBeTruthy();
    }
    expect(keys.queryByRole('button', { name: '☆123 (숫자·기호)' })).toBeNull();
    expect(explain().textContent).toMatch(/「ああ」/);
  });

  it('키를 누르면 그 키의 역할을 보여 주고, 누른 키만 눌린 상태로 표시한다', () => {
    render(<KeyboardKeys />);
    const space = within(keyboard()).getByRole('button', { name: '空白 / 次候補' });
    fireEvent.click(space);

    expect(space.getAttribute('aria-pressed')).toBe('true');
    expect(explain().textContent).toMatch(/次候補/);
    expect(
      within(keyboard())
        .getByRole('button', { name: '→ (문자 보내기)' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('「フリックのみ」를 켜면 왼쪽 줄이 ☆123 ABC あいう 이모지로 바뀐다', () => {
    render(<KeyboardKeys />);
    fireEvent.click(screen.getByRole('button', { name: '켜짐' }));
    const keys = within(keyboard());

    expect(keys.queryByRole('button', { name: '→ (문자 보내기)' })).toBeNull();
    expect(keys.queryByRole('button', { name: '↺ (거꾸로)' })).toBeNull();
    expect(keys.getByRole('button', { name: '☆123 (숫자·기호)' })).toBeTruthy();
    expect(keys.getByRole('button', { name: 'あいう (かな)' })).toBeTruthy();
    // 보던 키(→)가 사라졌으므로 그 자리의 키 설명으로 넘어간다
    expect(explain().textContent).toMatch(/숫자와 기호/);
  });

  it('글자 키를 누르면 탭과 플릭으로 나오는 글자를 도해로 보여 준다', () => {
    render(<KeyboardKeys />);
    fireEvent.click(within(keyboard()).getByRole('button', { name: 'わ 키' }));

    expect(explain().textContent).toMatch(/탭하면 わ/);
    expect(within(explain()).getByRole('img').getAttribute('aria-label')).toMatch(/오른쪽 ー/);
  });
});
