// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { findLevel } from '@twiper/content';
import '../../i18n';
import { Drill } from './Drill';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** 지금 줄을 한 번의 조합으로 치고 確定한다 */
async function typeLine(input: HTMLInputElement, line: string) {
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.value = line;
  input.dispatchEvent(new CompositionEvent('compositionupdate', { data: line }));
  input.dispatchEvent(
    new InputEvent('input', { data: line, inputType: 'insertCompositionText', isComposing: true }),
  );
  await flush();
  input.dispatchEvent(new CompositionEvent('compositionend', { data: line }));
  await flush();
}

const currentLine = () => document.querySelector('.target-text')?.textContent ?? '';

function renderDrill(id: string) {
  const level = findLevel(id);
  if (!level) throw new Error(`레벨 ${id} 없음`);
  render(
    <MemoryRouter>
      <Drill level={level} />
    </MemoryRouter>,
  );
  return level;
}

describe('Drill', () => {
  it('시작을 누르면 그 자리에서 입력창에 포커스한다', () => {
    renderDrill('L2');

    fireEvent.click(screen.getByRole('button', { name: '시작' }));

    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('줄을 다 치고 確定하면 같은 입력창에서 다음 줄로 넘어가고, 끝나면 결과를 보여 준다', async () => {
    const level = renderDrill('L2');
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    const input = screen.getByRole<HTMLInputElement>('textbox');

    for (let i = 1; i <= level.drill.lineCount; i += 1) {
      expect(screen.getByText(`${i}/${level.drill.lineCount}`)).toBeTruthy();
      expect(screen.getByRole('textbox')).toBe(input);
      await typeLine(input, currentLine());
    }

    expect(screen.getByRole('heading', { name: /끝$/ })).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('한 번도 틀리지 않았어요.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /다음: Lv\.3/ })).toBeTruthy();
  });

  it('같은 레벨을 다시 끝내면 지난 판과 비교해 보여 준다', async () => {
    const level = renderDrill('L1');
    const playAll = async () => {
      for (let i = 0; i < level.drill.lineCount; i += 1) {
        await typeLine(screen.getByRole<HTMLInputElement>('textbox'), currentLine());
      }
    };
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    await playAll();
    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }));
    await playAll();

    // 두 판 모두 한 번에 맞혀 정확도 차이는 없다
    expect(await screen.findByText('지난번보다 \u{00B1}0%p')).toBeTruthy();
  });

  it('결과에서 다시 하기를 누르면 첫 줄부터 다시 입력창에 포커스한다', async () => {
    const level = renderDrill('L1');
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    for (let i = 0; i < level.drill.lineCount; i += 1) {
      await typeLine(screen.getByRole<HTMLInputElement>('textbox'), currentLine());
    }

    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }));

    expect(screen.getByText(`1/${level.drill.lineCount}`)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
});
