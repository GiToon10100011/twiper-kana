// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { examSource } from '@twiper/content';
import { advanceExam, createExam, parseRuby, rubySurface } from '@twiper/core';
import '../../i18n';
import { trainingRepo } from '../../lib/db';
import { loadExamRecords } from '../../lib/examRecords';
import { hasSeenExamRules, markExamRulesSeen } from '../../lib/flags';
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings';
import { ExamRoute } from './ExamRun';

beforeAll(() => {
  // jsdom의 <dialog>에는 모달로 열고 닫는 메서드가 없다
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  // 주의사항 창은 처음 한 번만 저절로 뜬다. 다른 테스트는 이미 본 것으로 시작한다
  markExamRulesSeen();
  // 입력 스냅샷과 테스트 시간은 performance.now를 쓴다. 같이 돌려야 1분이 지난다
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const tick = (ms = 1) => act(() => vi.advanceTimersByTimeAsync(ms));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>홈 화면</p>} />
        <Route path="/test/:mode" element={<ExamRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

const target = () => document.querySelector('.target-text')?.textContent ?? '';
const timer = () => screen.getByRole('timer').textContent;

/** 한 줄을 한 번의 조합으로 치고 確定한다 */
async function typeLine(line: string) {
  const input = screen.getByRole<HTMLInputElement>('textbox');
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.value = line;
  input.dispatchEvent(new CompositionEvent('compositionupdate', { data: line }));
  input.dispatchEvent(
    new InputEvent('input', { data: line, inputType: 'insertCompositionText', isComposing: true }),
  );
  await tick();
  input.dispatchEvent(new CompositionEvent('compositionend', { data: line }));
  await tick();
}

describe('ExamRun (종합 테스트)', () => {
  it('홈에서 받은 씨앗으로 같은 첫 줄을 내고, 첫 글자를 치기 전에는 시간이 가지 않는다', async () => {
    renderAt('/test/kana?min=1&seed=5');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('글자 테스트 · 1분');
    expect(target()).toBe(createExam(examSource('kana'), 5).line.text);
    expect(timer()).toBe('1:00');
    expect(screen.getByText(/첫 글자를 치면 시간이 흘러요/)).toBeTruthy();

    await tick(5_000);
    expect(timer()).toBe('1:00');
  });

  it('줄을 치고 確定하면 다음 줄을 끝없이 내고, 시간이 끝나면 결과와 기록을 남긴다', async () => {
    renderAt('/test/kana?min=1&seed=5');
    const first = createExam(examSource('kana'), 5);

    await typeLine(first.line.text);
    expect(target()).toBe(advanceExam(first).line.text);
    expect(screen.queryByText(/첫 글자를 치면/)).toBeNull();

    await tick(30_000);
    expect(timer()).toBe('0:30');

    await tick(30_500);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('글자 테스트 끝 · 1분');
    expect(screen.getByText('최고 기록이에요!')).toBeTruthy();
    expect(screen.getByText('1줄')).toBeTruthy();
    expect(loadExamRecords().kana?.plays).toBe(1);
    expect(loadExamRecords().kana?.best?.minutes).toBe(1);

    // 끝낸 줄은 시도 기록으로 저장해 「내 실력」 통계에 들어간다
    const saved = await trainingRepo().recentAttempts(10);
    expect(saved.some((a) => a.levelId === 'test-kana' && a.target === first.line.text)).toBe(true);
  });

  it('첫 글자를 친 때부터 정확히 시간이 다 되면 끝낸다', async () => {
    renderAt('/test/word?min=1&seed=3');
    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = 'か';
    input.dispatchEvent(
      new InputEvent('input', {
        data: 'か',
        inputType: 'insertCompositionText',
        isComposing: true,
      }),
    );
    // 스냅샷은 다음 작업에서 나가고(1ms) 그때부터 1분을 잰다
    await tick(1);

    await tick(59_998);
    expect(screen.getByRole('timer')).toBeTruthy();
    await tick(2);
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('단어 테스트 끝 · 1분');
  });

  it('긴 글은 다음 줄을 미리 보여 주고, 짧은 글·긴 글은 어절 사이에 틈을 둔다', () => {
    renderAt('/test/long?min=3&seed=2');
    const exam = createExam(examSource('long'), 2);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('긴 글 테스트 · 3분');
    // 다음 줄도 한자에 후리가나를 붙여 보인다 (표기 {…|…}는 보이지 않는다)
    const upcoming = screen.getByLabelText('다음 줄');
    const { rubies } = parseRuby(exam.upcoming?.text ?? '');
    expect(rubies.length).toBeGreaterThan(0);
    expect([...upcoming.querySelectorAll('ruby')].map((r) => r.firstChild?.textContent)).toEqual(
      rubies.map((ruby) => ruby.surface),
    );
    expect(upcoming.textContent).not.toContain('{');
    expect(document.querySelectorAll('.target-text .ch-word').length).toBe(
      exam.line.gapsAfter.length + 1,
    );
  });

  it('짧은 글의 한자는 그 한자로 바꿔 確定해야 다음 줄로 넘어가고, 읽기만 치면 밑줄 친 곳을 바꾸라고 안내한다', async () => {
    const seed = Array.from({ length: 50 }, (_, i) => i).find(
      (s) => parseRuby(createExam(examSource('short'), s).line.text).rubies.length > 0,
    );
    renderAt(`/test/short?min=1&seed=${seed}`);
    const first = createExam(examSource('short'), seed ?? 0);
    const input = screen.getByRole<HTMLInputElement>('textbox');

    expect(document.querySelector('.target-text ruby rt')).toBeTruthy();
    const shown = target();
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = parseRuby(first.line.text).chars.join('');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText' }));
    await tick();
    expect(screen.getByRole('status').textContent).toContain('밑줄 친 곳을 후보에서');

    // 히라가나 그대로 確定하면 넘어가지 않는다
    input.dispatchEvent(new CompositionEvent('compositionend', { data: input.value }));
    await tick();
    expect(target()).toBe(shown);
    expect(screen.getByRole('status').textContent).toContain('밑줄 친 곳은 후보에서');

    input.value = '';
    input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward' }));
    await tick();
    await typeLine(rubySurface(first.line.text));
    expect(target()).not.toBe(shown);
  });

  it('처음 들어오면 주의사항 창을 띄우고, 알겠어요를 누르면 닫고 입력창으로 돌아간다. 다음부터는 저절로 띄우지 않는다', () => {
    localStorage.clear();
    renderAt('/test/kana?min=1&seed=5');
    const dialog = document.querySelector('dialog');

    expect(dialog?.open).toBe(true);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('테스트 주의사항');
    expect(screen.getByText('12키 가나 키보드로 쳐요')).toBeTruthy();
    expect(screen.getByText('確定을 눌러야 다음 줄로 넘어가요')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '알겠어요' }));
    expect(dialog?.open).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(hasSeenExamRules()).toBe(true);

    cleanup();
    renderAt('/test/kana?min=1&seed=5');
    expect(document.querySelector('dialog')?.open).toBe(false);
  });

  it('머리의 주의사항 버튼으로 언제든 다시 열고, 바깥을 누르면 닫는다', () => {
    renderAt('/test/short?min=1&seed=1');
    const dialog = document.querySelector('dialog');
    expect(dialog?.open).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '테스트 주의사항' }));
    expect(dialog?.open).toBe(true);

    // 배경을 누르면 dialog 자체가 눌린다 (안쪽 상자를 누르면 닫히지 않는다)
    fireEvent.click(screen.getByText('도움말은 나오지 않아요'));
    expect(dialog?.open).toBe(true);
    if (dialog) fireEvent.click(dialog);
    expect(dialog?.open).toBe(false);
  });

  it('설정에서 「한자는 바꿔야 정답」을 끄면 주의사항이 바뀌고, 짧은 글의 한자는 읽기대로만 쳐도 넘어간다', async () => {
    saveSettings({ ...DEFAULT_SETTINGS, requireKanji: false });
    const seed = Array.from({ length: 50 }, (_, i) => i).find(
      (s) => parseRuby(createExam(examSource('short'), s).line.text).rubies.length > 0,
    );
    renderAt(`/test/short?min=1&seed=${seed}`);
    const first = createExam(examSource('short'), seed ?? 0);

    fireEvent.click(screen.getByRole('button', { name: '테스트 주의사항' }));
    expect(screen.getByText('가타카나는 후보에서 골라 바꿔야 맞아요')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '알겠어요' }));

    const shown = target();
    await typeLine(parseRuby(first.line.text).chars.join(''));
    expect(target()).not.toBe(shown);
  });

  it('알 수 없는 종목이면 홈으로 보낸다', () => {
    renderAt('/test/nope');

    expect(screen.getByText('홈 화면')).toBeTruthy();
  });
});
