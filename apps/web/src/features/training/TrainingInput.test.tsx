// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP_POLICY, type InputSessionState } from '@twiper/core';
import { TrainingInput } from './TrainingInput';

afterEach(cleanup);

/** 어댑터가 setTimeout(0)으로 모은 스냅샷을 내보낼 때까지 기다린다. */
const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** iOS かな 키보드처럼 조합 중 값이 바뀌는 이벤트를 흉내 낸다. */
async function compose(input: HTMLInputElement, value: string) {
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.value = value;
  input.dispatchEvent(new CompositionEvent('compositionupdate', { data: value }));
  input.dispatchEvent(
    new InputEvent('input', { data: value, inputType: 'insertCompositionText', isComposing: true }),
  );
  await flush();
}

async function commit(input: HTMLInputElement) {
  input.dispatchEvent(new CompositionEvent('compositionend', { data: input.value }));
  await flush();
}

describe('TrainingInput', () => {
  it('조합 중 일치하면 確定 안내를 보여 주고, 確定한 뒤에만 완료를 알린다', async () => {
    const onComplete = vi.fn();
    render(<TrainingInput target="あい" onComplete={onComplete} matchedHint="確定을 누르세요" />);
    const input = screen.getByRole<HTMLInputElement>('textbox');

    await compose(input, 'あ');
    await compose(input, 'あい');
    expect(screen.getByRole('status').textContent).toBe('確定을 누르세요');
    expect(onComplete).not.toHaveBeenCalled();

    await commit(input);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].matchedAt).not.toBeNull();
    expect(input.value).toBe('');
  });

  it('commit 판정: 읽기를 다 치면 후보 안내, 히라가나로 確定하면 고치라는 경고, 변환해야 완료', async () => {
    const onComplete = vi.fn();
    render(
      <TrainingInput
        target="カメラ"
        judge="commit"
        onComplete={onComplete}
        matchedHint="確定"
        convertHint="후보에서 고르세요"
        fixHint="지우고 다시"
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('textbox');
    const status = () => screen.getByRole('status');

    await compose(input, 'かめら');
    expect(status().textContent).toBe('후보에서 고르세요');

    await commit(input);
    expect(status().textContent).toBe('지우고 다시');
    expect(status().className).toContain('is-warning');
    expect(onComplete).not.toHaveBeenCalled();

    await compose(input, 'かめら');
    input.value = 'カメラ';
    await commit(input);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].errors.map((e: { cause: string }) => e.cause)).toEqual([
      'committed',
      'committed',
      'committed',
    ]);
  });

  it('목표가 바뀌어도 같은 입력창을 유지한다', async () => {
    const { rerender } = render(<TrainingInput target="あ" onComplete={() => {}} matchedHint="" />);
    const before = screen.getByRole('textbox');

    rerender(<TrainingInput target="か" onComplete={() => {}} matchedHint="" />);

    expect(screen.getByRole('textbox')).toBe(before);
  });

  it('경고가 있으면 확정 안내 대신 경고를 보여 준다', async () => {
    render(
      <TrainingInput
        target="か"
        onComplete={() => {}}
        matchedHint="確定"
        notice={(session) => (session.romajiActive ? '로마자 키보드' : null)}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('textbox');

    // 로마자 자판: k가 か로 바뀌어 목표와 같아졌지만 確定 안내 대신 경고를 보인다
    await compose(input, 'k');
    await compose(input, 'か');

    expect(screen.getByRole('status').textContent).toBe('로마자 키보드');
  });

  it('도움말: 머뭇거린 글자는 치는 중에도 남고, 지나간 뒤 지워서 돌아오면 다시 머뭇거려야 뜬다', async () => {
    vi.useFakeTimers();
    try {
      const help = (session: InputSessionState, stuckAt: number | null) =>
        stuckAt === session.matched ? <aside>도움 {stuckAt}</aside> : null;
      render(<TrainingInput target="ぎい" onComplete={() => {}} matchedHint="" help={help} />);
      const input = screen.getByRole<HTMLInputElement>('textbox');
      const card = () => screen.queryByRole('complementary')?.textContent ?? null;
      const type = async (value: string) => {
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

      await act(() => vi.advanceTimersByTimeAsync(HELP_POLICY.idleMs));
      expect(card()).toBe('도움 0');

      input.dispatchEvent(new CompositionEvent('compositionstart'));
      // ぎ를 치려고 き까지 친 상태: 아직 그 글자를 치는 중
      await type('き');
      expect(card()).toBe('도움 0');

      await type('ぎ');
      expect(card()).toBeNull();

      await type('');
      expect(card()).toBeNull();

      await act(() => vi.advanceTimersByTimeAsync(HELP_POLICY.idleMs));
      expect(card()).toBe('도움 0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('도움말: 설정한 시간만큼 기다리고, 0이면 아무리 멈춰도 띄우지 않는다', async () => {
    vi.useFakeTimers();
    try {
      const help = (_: InputSessionState, stuckAt: number | null) =>
        stuckAt === null ? null : <aside>도움</aside>;
      const renderWith = (idleMs: number) =>
        render(
          <TrainingInput target="あ" onComplete={() => {}} matchedHint="" {...{ help, idleMs }} />,
        );

      const view = renderWith(30_000);
      await act(() => vi.advanceTimersByTimeAsync(29_900));
      expect(screen.queryByRole('complementary')).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(100));
      expect(screen.queryByRole('complementary')).not.toBeNull();
      view.unmount();

      renderWith(0);
      await act(() => vi.advanceTimersByTimeAsync(HELP_POLICY.idleMs * 10));
      expect(screen.queryByRole('complementary')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
