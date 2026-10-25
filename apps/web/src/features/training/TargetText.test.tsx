// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInputSession, reduceInputSession, type InputSessionState } from '@twiper/core';
import { TargetText } from './TargetText';

afterEach(cleanup);

const typed = (target: string, value: string): InputSessionState =>
  reduceInputSession(createInputSession(target, 'commit'), { t: 100, value, composing: true });

const renderTarget = (session: InputSessionState) =>
  render(<TargetText session={session} />).container;

describe('TargetText — 한자 표기', () => {
  it('한자 위에 읽기를 작게 붙이고, 가나는 그대로 둔다', () => {
    const view = renderTarget(typed('{今日|きょう}は', ''));
    const ruby = view.querySelector('.target-text ruby');

    expect(ruby?.firstChild?.textContent).toBe('今日');
    expect(ruby?.querySelector('rt')?.textContent).toBe('きょう');
    expect(view.querySelector('.target-text')?.lastElementChild?.textContent).toBe('は');
  });

  it('읽기를 다 맞게 치면 한자도 친 것으로 보인다 (변환하지 않아도)', () => {
    const view = renderTarget(typed('{今日|きょう}は', 'きょう'));

    expect(view.querySelector('ruby')?.className).toBe('ch-ruby ch-correct');
    expect([...view.querySelectorAll('rt span')].map((s) => s.className)).toEqual([
      'ch-correct',
      'ch-correct',
      'ch-correct',
    ]);
    // 다음에 칠 글자(は)에 밑줄
    expect(view.querySelector('.ch-next')?.textContent).toBe('は');
  });

  it('읽기를 치는 중이면 한자는 아직 칠 글자로 보이고, 다음 읽기 글자에 밑줄을 긋는다', () => {
    const view = renderTarget(typed('{今日|きょう}は', 'き'));

    expect(view.querySelector('ruby')?.className).toBe('ch-ruby ch-todo');
    expect(view.querySelector('rt .ch-next')?.textContent).toBe('ょ');
  });
});
