// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { CharFinder } from './CharFinder';

afterEach(cleanup);

const input = () => screen.getByLabelText('찾을 글자');
const table = () => screen.getByRole('group', { name: /^(기본|탁음·반탁음|작은 글자|요음|기호)$/ });

describe('CharFinder (글자 찾기)', () => {
  it('붙여 넣은 글을 소리 단위로 나눠 키와 방향, 小゛゜ 횟수를 보여 준다', () => {
    render(<CharFinder />);
    fireEvent.change(input(), { target: { value: 'ぎゃ' } });
    const result = screen.getByRole('region', { name: 'ぎゃ 치는 법' });

    expect(result.textContent).toMatch(/か 키 왼쪽 · 小゛゜ 1번/);
    expect(result.textContent).toMatch(/や 키 탭 · 小゛゜ 1번/);
  });

  it('가타카나는 읽기를 친 뒤 후보에서 고르라고 한 번만 안내한다', () => {
    render(<CharFinder />);
    fireEvent.change(input(), { target: { value: 'コーヒー' } });
    const notes = screen
      .getByRole('region', { name: 'コーヒー 치는 법' })
      .querySelectorAll('.find-note');

    expect(Array.from(notes, (note) => note.textContent)).toEqual([
      '가타카나는 히라가나로 친 뒤 후보에서 골라요: こーひー → コーヒー',
    ]);
  });

  it('섞인 글에서는 이어진 가타카나 묶음만 변환 안내에 넣는다', () => {
    render(<CharFinder />);
    fireEvent.change(input(), { target: { value: 'コーヒーとケーキ' } });
    const result = screen.getByRole('region', { name: 'コーヒーとケーキ 치는 법' });

    expect(result.textContent).toMatch(/こーひー → コーヒー, けーき → ケーキ/);
    expect(result.textContent).not.toMatch(/コーヒーと/);
  });

  it('키에 없는 글자가 한자가 아니면 한자 안내 대신 아직 보여 주지 못한다고 알린다', () => {
    render(<CharFinder />);
    fireEvent.change(input(), { target: { value: 'Xa' } });
    const result = screen.getByRole('region', { name: 'Xa 치는 법' });

    expect(result.textContent).toMatch(/아직 치는 법을 보여 주지 못해요/);
    expect(result.textContent).not.toMatch(/한자는/);
    expect(result.textContent).toMatch(/ABC 자판 · ABC 키 탭/);
  });

  it('☆123 자판의 기호와 키에 없는 한자도 알려 준다', () => {
    render(<CharFinder />);
    fireEvent.change(input(), { target: { value: '人々' } });
    const result = screen.getByRole('region', { name: '人々 치는 법' });

    expect(result.textContent).toMatch(/키에 없는 글자예요/);
    expect(result.textContent).toMatch(/☆123 자판 · 8 키 위/);
    expect(result.textContent).toMatch(/한자는 읽는 법을/);
    expect(result.textContent).not.toMatch(/아직 치는 법을/);
  });

  it('표에서 글자를 누르면 그 줄 아래에 치는 법을 펼치고, 다시 누르면 접는다', () => {
    render(<CharFinder />);
    fireEvent.click(screen.getByRole('button', { name: '탁음·반탁음' }));
    const pa = within(table()).getByRole('button', { name: 'ぱ' });

    fireEvent.click(pa);
    expect(pa.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'ぱ 치는 법' }).textContent).toMatch(
      /は 키 탭 · 小゛゜ 2번/,
    );

    fireEvent.click(pa);
    expect(screen.queryByRole('region', { name: 'ぱ 치는 법' })).toBeNull();
  });

  it('표를 바꾸면 펼친 설명을 닫는다', () => {
    render(<CharFinder />);
    fireEvent.click(within(table()).getByRole('button', { name: 'き' }));
    fireEvent.click(screen.getByRole('button', { name: '요음' }));

    expect(screen.queryByRole('region', { name: 'き 치는 법' })).toBeNull();
    expect(within(table()).getByRole('button', { name: 'きゃ' })).toBeTruthy();
  });
});
