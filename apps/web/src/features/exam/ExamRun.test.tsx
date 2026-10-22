// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { examSource } from '@twiper/content';
import { advanceExam, createExam } from '@twiper/core';
import '../../i18n';
import { trainingRepo } from '../../lib/db';
import { loadExamRecords } from '../../lib/examRecords';
import { ExamRoute } from './ExamRun';

beforeEach(() => {
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
    expect(screen.getByLabelText('다음 줄').textContent).toBe(exam.upcoming?.text);
    expect(document.querySelectorAll('.target-text .ch-word').length).toBe(
      exam.line.gapsAfter.length + 1,
    );
  });

  it('알 수 없는 종목이면 홈으로 보낸다', () => {
    renderAt('/test/nope');

    expect(screen.getByText('홈 화면')).toBeTruthy();
  });
});
