import { describe, expect, it } from 'vitest';
import { reduceInputSession, replayInputSession, type InputSnapshot } from '../../src/index';

const composing = (values: string[]): InputSnapshot[] =>
  values.map((value, i) => ({ t: (i + 1) * 100, value, composing: true }));

describe('completeOnCommit (결정 0001)', () => {
  it('조합 중 일치 시각을 정답 시각으로 남기고, 완료는 確定 후로 미룬다', () => {
    const matched = replayInputSession('あいう', composing(['あ', 'あい', 'あいう']), 'composing', {
      completeOnCommit: true,
    });
    expect(matched.matchedAt).toBe(300);
    expect(matched.completedAt).toBeNull();

    const committed = reduceInputSession(matched, { t: 900, value: 'あいう', composing: false });
    expect(committed.completedAt).toBe(900);
    expect(committed.matchedAt).toBe(300);
  });

  it('틀린 채 確定하면 완료되지 않고, 고친 뒤 다시 確定하면 완료된다', () => {
    const wrongCommit = replayInputSession(
      'あい',
      [...composing(['あ', 'あう']), { t: 300, value: 'あう', composing: false }],
      'composing',
      { completeOnCommit: true },
    );
    expect(wrongCommit.completedAt).toBeNull();

    const fixed = [
      { t: 400, value: 'あ', composing: false },
      { t: 500, value: 'あい', composing: true },
      { t: 600, value: 'あい', composing: false },
    ].reduce(reduceInputSession, wrongCommit);
    expect(fixed.errors).toEqual([
      { index: 1, expected: 'い', actual: 'う', cause: 'deleted', t: 400 },
    ]);
    expect(fixed.matchedAt).toBe(500);
    expect(fixed.completedAt).toBe(600);
  });

  it('옵션이 없으면 예전처럼 조합 중 일치에서 완료한다', () => {
    const state = replayInputSession('あ', composing(['あ']));

    expect(state.matchedAt).toBe(100);
    expect(state.completedAt).toBe(100);
  });

  it('commit 판정은 確定 시각이 정답 시각이다', () => {
    const state = replayInputSession(
      'カメラ',
      [...composing(['か', 'かめら', 'カメラ']), { t: 700, value: 'カメラ', composing: false }],
      'commit',
    );

    expect(state.matchedAt).toBe(700);
    expect(state.completedAt).toBe(700);
  });
});
