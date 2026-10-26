// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatLines, findLevel, type Level } from '@twiper/content';
import { HELP_POLICY, parseRuby, rubySurface, toHiragana, variantBase } from '@twiper/core';
import '../../i18n';
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings';
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

/** 화면의 글자: 한자 표기는 한자 다음에 후리가나가 이어진다 ({今日|きょう}は → 今日きょうは) */
function shownText(word: string): string {
  const { chars, rubies } = parseRuby(word);
  let out = '';
  let i = 0;
  for (const ruby of rubies) {
    out += chars.slice(i, ruby.start).join('') + ruby.surface;
    out += chars.slice(ruby.start, ruby.end).join('');
    i = ruby.end;
  }
  return out + chars.slice(i).join('');
}

/** 지금 화면에 나온 문장 (한자 표기 그대로) */
const currentWord = (level: Level) =>
  (level.drill.words ?? []).find((word) => shownText(word) === currentLine()) ?? '';

/** 조합 중인 값을 바꾼다. done이면 그 값으로 確定한다 */
async function compose(input: HTMLInputElement, value: string, done = false) {
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText' }));
  await flush();
  if (!done) return;
  input.dispatchEvent(new CompositionEvent('compositionend', { data: value }));
  await flush();
}

/** あ행 글자를 내는 플릭 방향 이름 */
const flickLabel = (char: string) =>
  ['탭', '왼쪽', '위', '오른쪽', '아래'][Array.from('あいうえお').indexOf(char)];

/** 준비 화면 「이 레벨의 키」의 키 도해들 (키마다 방향별 글자) */
const keyDiagrams = () =>
  within(screen.getByLabelText('이 레벨의 키'))
    .getAllByRole('img')
    .map((img) => img.getAttribute('aria-label'));

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

  it('조합 레벨에서 탁점을 빠뜨리면 결과에 「탁점」으로 센다', async () => {
    const level = renderDrill('L11');
    expect(screen.getByText(/「小゛゜」를 한 번/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    let slipped = false;

    for (let i = 0; i < level.drill.lineCount + 2; i += 1) {
      if (!document.querySelector('.target-text')) break;
      const input = screen.getByRole<HTMLInputElement>('textbox');
      const line = Array.from(currentLine());
      const k = line.findIndex((char, j) => j < line.length - 1 && variantBase(char) !== char);
      if (!slipped && k !== -1) {
        // 탁점을 붙이지 않은 채 다음 글자로 넘어갔다가, 지우고 고쳐 친다
        const wrong = [...line.slice(0, k), variantBase(line[k] ?? ''), line[k + 1] ?? ''].join('');
        input.dispatchEvent(new CompositionEvent('compositionstart'));
        input.value = wrong;
        input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText' }));
        await flush();
        slipped = true;
      }
      await typeLine(input, line.join(''));
    }

    expect(slipped).toBe(true);
    expect(await screen.findByText('탁점')).toBeTruthy();
  });

  it('가타카나 레벨: 읽기로 친 뒤 후보로 변환해 確定해야 넘어가고, 히라가나로 確定하면 「변환 안 함」으로 센다', async () => {
    const level = renderDrill('L16');
    expect(screen.getByText(/후보 줄에서 가타카나를 눌러요/)).toBeTruthy();
    expect(screen.getByText('かめら')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    let first = true;

    for (let i = 0; i < level.drill.lineCount + 2; i += 1) {
      if (!document.querySelector('.target-text')) break;
      const input = screen.getByRole<HTMLInputElement>('textbox');
      const word = currentLine();
      const reading = toHiragana(word);
      input.dispatchEvent(new CompositionEvent('compositionstart'));
      input.value = reading;
      input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText' }));
      await flush();
      expect(screen.getByRole('status').textContent).toContain('후보에서');
      if (first) {
        // 변환하지 않고 히라가나 그대로 確定했다가 지우고 다시 친다
        input.dispatchEvent(new CompositionEvent('compositionend', { data: reading }));
        await flush();
        expect(screen.getByRole('status').textContent).toContain('지우고 다시');
        input.value = '';
        input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward' }));
        await flush();
        input.dispatchEvent(new CompositionEvent('compositionstart'));
        input.value = reading;
        input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText' }));
        await flush();
        first = false;
      }
      // 후보를 누르면 iOS는 가타카나로 바로 確定한다
      input.value = word;
      input.dispatchEvent(new CompositionEvent('compositionend', { data: word }));
      await flush();
    }

    expect(first).toBe(false);
    expect(await screen.findByText('변환 안 함')).toBeTruthy();
  });

  it('장음 레벨은 준비 화면에 わ 키 도해(→ ー)를 보여 준다', () => {
    renderDrill('L17');

    expect(screen.getByText(/わ 키를 오른쪽으로/)).toBeTruthy();
    expect(screen.getAllByLabelText('이 레벨의 키')).toHaveLength(2);
    expect(screen.getByText('こーひー')).toBeTruthy();
  });

  it('외래음 레벨은 준비 화면에 작은 모음을 만드는 순서(て + い + 小゛゜ → ティ)와 あ 키 도해를 보여 준다', () => {
    renderDrill('L18');

    expect(screen.getByText(/작은 ァィゥェォ가 붙는 소리/)).toBeTruthy();
    const [howTo] = screen.getAllByLabelText('이 레벨의 키');
    const rows = [...(howTo?.querySelectorAll('li') ?? [])].map((li) =>
      li.textContent?.replace(/\s+/g, ''),
    );
    expect(rows).toEqual([
      'て+い+小゛゜→후보ティ',
      'ふ+あ+小゛゜→후보ファ',
      'し+え+小゛゜→후보シェ',
    ]);
    expect(screen.getAllByLabelText('이 레벨의 키')).toHaveLength(2);
  });

  it('ヴ 레벨은 준비 화면에 う + 小゛゜×2로 ゔ를 만드는 순서를 보여 준다', () => {
    renderDrill('L19');

    expect(screen.getByText(/「小゛゜」를 두 번 눌러 ゔ로/)).toBeTruthy();
    const [howTo] = screen.getAllByLabelText('이 레벨의 키');
    const rows = [...(howTo?.querySelectorAll('li') ?? [])].map((li) =>
      li.textContent?.replace(/\s+/g, ''),
    );
    expect(rows).toEqual([
      'う+小゛゜×2→후보ヴ',
      'う+小゛゜×2+あ+小゛゜→후보ヴァ',
      'う+小゛゜×2+お+小゛゜→후보ヴォ',
    ]);
  });

  it('문장부호 레벨은 준비 화면에 「、。?!」 키와 や 키(「」) 도해를 보여 준다', () => {
    renderDrill('L20');

    expect(screen.getByText(/짧은 말 10개/)).toBeTruthy();
    expect(screen.getByText(/「」는 や 키를/)).toBeTruthy();
    expect(keyDiagrams()).toEqual([
      '탭 、, 왼쪽 。, 위 ？, 오른쪽 ！',
      '탭 や, 왼쪽 「, 위 ゆ, 오른쪽 」, 아래 よ',
    ]);
  });

  it('☆123 기호 레벨은 준비 화면에 ☆123 자판의 1·4·0 키 도해를 보여 준다', () => {
    renderDrill('L21');

    // 「フリックのみ」가 꺼져 있을 때의 길(ABC → ☆123)도 알려 준다 (글자 찾기의 안내와 같게)
    expect(screen.getByText(/「☆123」 키로 자판을 바꿔서.*ABC 키를 누른 뒤 ☆123/)).toBeTruthy();
    expect(keyDiagrams()).toEqual([
      '탭 1, 왼쪽 ☆, 위 ♪, 오른쪽 →',
      '탭 4, 왼쪽 ○, 위 ＊, 오른쪽 ・',
      '탭 0, 왼쪽 〜, 위 …',
    ]);
  });

  it('다음 글자에서 한동안 진행이 없으면 그 글자를 치는 법을 입력창 아래에 보여 준다', async () => {
    vi.useFakeTimers();
    try {
      renderDrill('L12');
      fireEvent.click(screen.getByRole('button', { name: '시작' }));
      const first = Array.from(currentLine())[0] ?? '';

      await act(() => vi.advanceTimersByTimeAsync(HELP_POLICY.idleMs - 100));
      expect(screen.queryByRole('complementary')).toBeNull();

      await act(() => vi.advanceTimersByTimeAsync(100));
      const card = screen.getByRole('complementary', { name: `${first} 치는 법` });
      // 탁음이면 기본 글자를 친 뒤 「小゛゜」를 누르라고 보여 준다
      expect(card.textContent?.includes('小゛゜')).toBe(variantBase(first) !== first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('설정에서 고른 시간만큼 멈추면 도움말을 띄운다', async () => {
    saveSettings({ ...DEFAULT_SETTINGS, helpIdleMs: 30_000 });
    vi.useFakeTimers();
    try {
      renderDrill('L12');
      fireEvent.click(screen.getByRole('button', { name: '시작' }));

      await act(() => vi.advanceTimersByTimeAsync(29_900));
      expect(screen.queryByRole('complementary')).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(100));
      expect(screen.queryByRole('complementary')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('실력 확인용 레벨(50음 랜덤)은 오래 멈추거나 여러 번 틀려도 도움말을 띄우지 않는다', async () => {
    vi.useFakeTimers();
    try {
      renderDrill('L10');
      expect(screen.getByText(/도움말이 나오지 않아요/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '시작' }));
      const input = screen.getByRole<HTMLInputElement>('textbox');
      const compose = async (value: string) => {
        input.value = value;
        input.dispatchEvent(
          new InputEvent('input', {
            data: value,
            inputType: 'insertCompositionText',
            isComposing: true,
          }),
        );
        await act(() => vi.advanceTimersByTimeAsync(1));
      };

      await act(() => vi.advanceTimersByTimeAsync(HELP_POLICY.idleMs * 3));
      expect(screen.queryByRole('complementary')).toBeNull();

      // 첫 글자 자리에 다른 글자를 쳤다가 지우기를 두 번
      const wrong = Array.from(currentLine())[0] === 'ん' ? 'あ' : 'ん';
      input.dispatchEvent(new CompositionEvent('compositionstart'));
      await compose(wrong);
      await compose('');
      await compose(wrong);
      await compose('');
      expect(screen.queryByRole('complementary')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('이번 판에서 두 번 틀린 글자는 기다리지 않고 바로 치는 법을 보여 준다', async () => {
    renderDrill('L1');
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    const input = screen.getByRole<HTMLInputElement>('textbox');
    const first = Array.from(currentLine())[0] ?? '';
    const compose = async (value: string) => {
      input.value = value;
      input.dispatchEvent(
        new InputEvent('input', {
          data: value,
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      );
      await flush();
    };

    input.dispatchEvent(new CompositionEvent('compositionstart'));
    // あ행 줄의 첫 글자 자리에 か를 쳤다가 지우기를 두 번
    await compose('か');
    await compose('');
    expect(screen.queryByRole('complementary')).toBeNull();
    await compose('か');
    await compose('');

    expect(screen.getByRole('complementary', { name: `${first} 치는 법` })).toBeTruthy();
    expect(screen.getByText(`あ 키 ${flickLabel(first)}`)).toBeTruthy();
  });

  it('로마자 키보드 안내는 かな 키보드로 바꿔 치기 시작하면 사라진다', async () => {
    renderDrill('L2');
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    const input = screen.getByRole<HTMLInputElement>('textbox');
    const line = currentLine();

    await compose(input, 'k');
    expect(screen.getByRole('status').textContent).toContain('로마자 키보드');

    // k를 지우고 키보드를 바꿔 플릭으로 친다. 모음(あ행)은 로마자 자판에서도 바로 나오므로 자음 가나까지 친다
    await compose(input, '');
    let typed = '';
    for (const char of Array.from(line)) {
      typed += char;
      await compose(input, typed);
      if (!'あいうえお'.includes(char)) break;
    }

    expect(screen.getByRole('status').textContent).not.toContain('로마자 키보드');
  });

  it('짧은 문장 레벨: 히라가나만 치면 밑줄 친 곳을 바꾸라고 안내하고, 한자로 바꿔 確定해야 넘어간다', async () => {
    const level = renderDrill('L22');
    expect(screen.getByText(/후보에서 그 한자를 골라 바꿔야 해요/)).toBeTruthy();
    expect(screen.getByText(/도움말이 나오지 않아요/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    const input = screen.getByRole<HTMLInputElement>('textbox');
    const word = currentWord(level);
    const reading = parseRuby(word).chars.join('');
    expect(word).not.toBe('');
    expect(document.querySelector('.trainer.is-sentence ruby rt')).toBeTruthy();

    await compose(input, reading);
    expect(screen.getByRole('status').textContent).toContain('밑줄 친 곳을 후보에서 골라');

    // 바꾸지 않고 히라가나 그대로 確定하면 그 한자에 밑줄을 긋고, 다음 줄로 넘어가지 않는다
    input.dispatchEvent(new CompositionEvent('compositionend', { data: reading }));
    await flush();
    expect(screen.getByRole('status').textContent).toContain('밑줄 친 곳은 후보에서');
    expect(document.querySelector('ruby.ch-unconverted')).toBeTruthy();
    expect(screen.getByText(`1/${level.drill.lineCount}`)).toBeTruthy();

    input.value = '';
    input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward' }));
    await flush();
    await compose(input, rubySurface(word), true);

    expect(screen.getByText(`2/${level.drill.lineCount}`)).toBeTruthy();
  });

  it('채팅 레벨: 상대 말풍선에 후리가나를 붙여 보이고, 칠 답은 내 말풍선 안에 둔다', async () => {
    const level = renderDrill('L23');
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    const reply = currentWord(level);
    const partner = chatLines.find((line) => line.reply === reply)?.partner ?? '';
    const bubble = document.querySelector('.chat-bubble.is-partner');

    expect(reply).not.toBe('');
    expect(bubble?.textContent).toBe(shownText(partner));
    expect(bubble?.querySelector('ruby rt')).toBeTruthy();
    expect(document.querySelector('.chat-bubble.is-me .target-text')?.textContent).toBe(
      shownText(reply),
    );

    await compose(screen.getByRole<HTMLInputElement>('textbox'), rubySurface(reply), true);

    expect(screen.getByText(`2/${level.drill.lineCount}`)).toBeTruthy();
    expect(document.querySelector('.chat-bubble.is-partner')?.textContent).not.toBe(
      shownText(partner),
    );
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
