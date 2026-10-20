import { describe, expect, it } from 'vitest';
import {
  HELP_POLICY,
  helpIndex,
  missCounts,
  replayInputSession,
  type InputSnapshot,
  type LineResult,
} from '../../src/index';

function snaps(values: string[], composing = true): InputSnapshot[] {
  return values.map((value, i) => ({ t: (i + 1) * 100, value, composing }));
}

const line = (target: string, missedIndexes: number[]): LineResult => ({
  target,
  units: Array.from(target).length,
  firstTryUnits: Array.from(target).length - missedIndexes.length,
  missed: [],
  missedIndexes,
  mistakeKinds: {},
  reactionMs: null,
  elapsedMs: null,
  romajiSuspected: false,
  toggleSuspected: false,
});

describe('missCounts', () => {
  it('끝낸 줄은 틀린 자리마다, 지금 줄은 기록된 오류마다 목표 글자로 센다', () => {
    const current = replayInputSession('がぎ', snaps(['か', 'かぎ', 'か', 'が']));
    const counts = missCounts([line('がぐ', [0]), line('ぎが', [1])], current);

    // が: 끝낸 줄 2번 + 지금 줄 1번(か를 두고 다음 글자를 침)
    expect(counts.get('が')).toBe(3);
    expect(counts.get('ぎ')).toBeUndefined();
  });

  it('목표보다 길게 친 초과분은 세지 않는다', () => {
    const current = replayInputSession('あ', snaps(['あい', 'あ']));
    expect([...missCounts([], current).keys()]).toEqual([]);
  });
});

describe('helpIndex', () => {
  const none = new Map<string, number>();

  it('다음에 칠 글자에서 머뭇거렸으면 그 위치를 돌려준다', () => {
    const state = replayInputSession('あいう', snaps(['あ']));
    expect(helpIndex(state, { stuckAt: 1, misses: none })).toBe(1);
    // 머뭇거린 곳을 지나갔으면 띄우지 않는다
    expect(helpIndex(state, { stuckAt: 0, misses: none })).toBeNull();
    expect(helpIndex(state, { stuckAt: null, misses: none })).toBeNull();
  });

  it('이번 판에서 여러 번 틀린 글자에 오면 바로 돌려준다', () => {
    const state = replayInputSession('あがう', snaps(['あ']));
    const twice = new Map([['が', HELP_POLICY.repeatMisses]]);
    const once = new Map([['が', HELP_POLICY.repeatMisses - 1]]);

    expect(helpIndex(state, { stuckAt: null, misses: twice })).toBe(1);
    expect(helpIndex(state, { stuckAt: null, misses: once })).toBeNull();
  });

  it('끝 글자가 아직 바뀌는 중(か→が)이면 그 글자 위치를 돌려준다', () => {
    const state = replayInputSession('がく', snaps(['か']));
    expect(helpIndex(state, { stuckAt: 0, misses: none })).toBe(0);
  });

  it('確定·변환·고치기를 기다릴 때는 띄우지 않는다', () => {
    const matched = replayInputSession('あい', snaps(['あい']));
    expect(helpIndex(matched, { stuckAt: 2, misses: none })).toBeNull();

    const reading = replayInputSession('カメ', snaps(['かめ']), 'commit');
    expect(helpIndex(reading, { stuckAt: 2, misses: none })).toBeNull();

    const committed = replayInputSession('カメ', snaps(['かめ'], false), 'commit');
    expect(helpIndex(committed, { stuckAt: 0, misses: none })).toBeNull();
  });

  it('commit 판정은 읽기로 맞춘 데까지 보고 다음 글자를 고른다', () => {
    const state = replayInputSession('カメラ', snaps(['かめ']), 'commit');
    expect(helpIndex(state, { stuckAt: 2, misses: none })).toBe(2);
  });
});
