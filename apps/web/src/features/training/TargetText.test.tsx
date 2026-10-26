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

  it('읽기를 다 치면 그 한자에 점선 밑줄(후보에서 고를 차례), 한자로 바꾸면 친 것으로 보인다', () => {
    const read = renderTarget(typed('{今日|きょう}は', 'きょう'));
    expect(read.querySelector('ruby')?.className).toBe('ch-ruby ch-pending');
    expect([...read.querySelectorAll('rt span')].map((s) => s.className)).toEqual([
      'ch-correct',
      'ch-correct',
      'ch-correct',
    ]);
    // 다음에 칠 글자(は)에 밑줄
    expect(read.querySelector('.ch-next')?.textContent).toBe('は');
    cleanup();

    const converted = renderTarget(typed('{今日|きょう}は', '今日'));
    expect(converted.querySelector('ruby')?.className).toBe('ch-ruby ch-correct');
  });

  it('읽기 그대로 確定해 버리면 그 한자를 틀린 자리로 밑줄 친다', () => {
    const committed = reduceInputSession(createInputSession('{今日|きょう}は', 'commit'), {
      t: 100,
      value: 'きょうは',
      composing: false,
    });
    const view = renderTarget(committed);

    expect(view.querySelector('ruby')?.className).toBe('ch-ruby ch-unconverted');
  });

  it('한자를 읽기로 쳐도 되는 설정이어도 바꾸지 않은 한자에는 점선 밑줄을 긋는다 (確定한 뒤에도 붉게 하지 않는다)', () => {
    const start = createInputSession('{今日|きょう}は{雨|あめ}', 'commit', { readingOk: true });
    const typing = reduceInputSession(start, { t: 100, value: 'きょう', composing: true });
    expect(renderTarget(typing).querySelector('ruby')?.className).toBe('ch-ruby ch-pending');
    cleanup();

    // 읽기까지 確定하고 이어 치는 중
    const committed = reduceInputSession(typing, { t: 200, value: 'きょうは', composing: false });
    expect(renderTarget(committed).querySelector('ruby')?.className).toBe('ch-ruby ch-pending');
  });

  it('어절 틈이 있는 줄(종합 테스트)도 한자에 후리가나를 붙이고, 틈은 읽기 위치로 나눈다', () => {
    // {今日|きょう}は / いい / {天気|てんき}。 — 틈은 は(3)와 い(5) 뒤
    const session = createInputSession('{今日|きょう}はいい{天気|てんき}。', 'commit');
    const view = render(<TargetText session={session} gapsAfter={[3, 5]} />).container;
    const words = [...view.querySelectorAll('.ch-word')];

    expect(words.map((word) => word.textContent)).toEqual(['今日きょうは', 'いい', '天気てんき。']);
    expect([...view.querySelectorAll('ruby')].map((ruby) => ruby.firstChild?.textContent)).toEqual([
      '今日',
      '天気',
    ]);
    expect(words[0]?.querySelector('rt')?.textContent).toBe('きょう');
  });

  it('읽기를 치는 중이면 한자는 아직 칠 글자로 보이고, 다음 읽기 글자에 밑줄을 긋는다', () => {
    const view = renderTarget(typed('{今日|きょう}は', 'き'));

    expect(view.querySelector('ruby')?.className).toBe('ch-ruby ch-todo');
    expect(view.querySelector('rt .ch-next')?.textContent).toBe('ょ');
  });
});
