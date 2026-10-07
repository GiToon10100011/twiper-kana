import { describe, expect, it } from 'vitest';
import {
  charStatuses,
  createInputSession,
  reduceInputSession,
  replayInputSession,
  type InputSnapshot,
} from '../../src/index';

/** 100ms 간격으로 들어오는 조합 중 스냅샷 열 */
function snaps(values: string[]): InputSnapshot[] {
  return values.map((value, i) => ({ t: (i + 1) * 100, value, composing: true }));
}

describe('InputSession — composing 판정', () => {
  it('플릭으로 한 글자씩 늘어나면 조합 중이어도 오류 없이 완료된다', () => {
    const state = replayInputSession(
      'あいうえお',
      snaps(['あ', 'あい', 'あいう', 'あいうえ', 'あいうえお']),
    );

    expect(state.startedAt).toBe(100);
    expect(state.completedAt).toBe(500);
    expect(state.errors).toEqual([]);
    expect(state.unitTimes).toEqual([100, 200, 300, 400, 500]);
  });

  it('탁점 순환(か→が)은 오류가 아니고, 올바른 형태가 된 시점을 기록한다', () => {
    const state = replayInputSession('がぎ', snaps(['か', 'が', 'がき', 'がぎ']));

    expect(state.errors).toEqual([]);
    expect(state.completedAt).toBe(400);
    expect(state.unitTimes).toEqual([200, 400]);
  });

  it('반탁점 순환과 소문자 변환도 중간 상태로 본다', () => {
    expect(replayInputSession('ぱ', snaps(['は', 'ば', 'ぱ'])).errors).toEqual([]);
    expect(replayInputSession('きって', snaps(['き', 'きつ', 'きっ', 'きって'])).errors).toEqual(
      [],
    );
    expect(replayInputSession('きゃ', snaps(['き', 'きや', 'きゃ'])).errors).toEqual([]);
  });

  it('틀린 글자를 지우고 고치면 오류 1건을 기록한다', () => {
    const state = replayInputSession('え', snaps(['う', '', 'え']));

    expect(state.errors).toEqual([
      { index: 0, expected: 'え', actual: 'う', cause: 'deleted', t: 200 },
    ]);
    expect(state.completedAt).toBe(300);
  });

  it('틀린 글자 뒤에 다음 글자를 입력하면 그때 오류로 확정하고 중복 기록하지 않는다', () => {
    const state = replayInputSession('かき', snaps(['さ', 'さき', 'さ', '', 'か', 'かき']));

    expect(state.errors).toEqual([
      { index: 0, expected: 'か', actual: 'さ', cause: 'continued', t: 200 },
    ]);
    expect(state.completedAt).toBe(600);
  });

  it('마지막 글자는 틀려도 보류한다', () => {
    const state = replayInputSession('あい', snaps(['あ', 'あう']));

    expect(state.errors).toEqual([]);
    expect(charStatuses(state)).toEqual(['correct', 'pending']);
    expect(state.completedAt).toBeNull();
  });

  it('목표보다 길게 입력하면 초과분을 오류로 기록한다', () => {
    const state = replayInputSession('あい', snaps(['あ', 'あう', 'あうえ', 'あうえお']));

    expect(state.errors).toEqual([
      { index: 1, expected: 'い', actual: 'う', cause: 'continued', t: 300 },
      { index: 2, expected: '', actual: 'え', cause: 'continued', t: 400 },
    ]);
    expect(charStatuses(state)).toEqual(['correct', 'wrong']);
  });

  it('조합 중에 라틴 문자가 보이면 로마자 키보드로 추정한다', () => {
    const state = replayInputSession('か', snaps(['k', 'か']));

    expect(state.romajiSuspected).toBe(true);
    expect(state.errors).toEqual([]);
    expect(state.completedAt).toBe(200);
  });

  it('끝 글자가 같은 키 안에서 바뀌면 토글 입력으로 추정한다', () => {
    const state = replayInputSession('う', snaps(['あ', 'い', 'う']));

    expect(state.toggleSuspected).toBe(true);
    expect(state.errors).toEqual([]);
  });

  it('플릭 입력과 탁점 순환은 토글이나 로마자로 보지 않는다', () => {
    const state = replayInputSession('がき', snaps(['か', 'が', 'がき']));

    expect(state.toggleSuspected).toBe(false);
    expect(state.romajiSuspected).toBe(false);
  });

  it('전각 물결표(U+FF5E)는 물결 대시(U+301C)와 같은 문자로 본다', () => {
    const state = replayInputSession('\u{301C}', snaps(['\u{FF5E}']));

    expect(state.completedAt).toBe(100);
  });

  it('완료된 뒤에 온 스냅샷은 무시한다', () => {
    const done = replayInputSession('あ', snaps(['あ']));

    expect(reduceInputSession(done, { t: 999, value: '', composing: false })).toBe(done);
  });
});

describe('InputSession — commit 판정', () => {
  it('변환을 확정해야 완료된다', () => {
    const composing = replayInputSession(
      'カメラ',
      snaps(['か', 'かめ', 'かめら', 'カメラ']),
      'commit',
    );
    expect(composing.completedAt).toBeNull();

    const committed = reduceInputSession(composing, { t: 500, value: 'カメラ', composing: false });
    expect(committed.completedAt).toBe(500);
    expect(committed.errors).toEqual([]);
  });

  it('히라가나로 확정하면 완료되지 않고, 진행 중 글자를 오답으로 표시하지 않는다', () => {
    const state = reduceInputSession(createInputSession('カメラ', 'commit'), {
      t: 100,
      value: 'かめら',
      composing: false,
    });

    expect(state.completedAt).toBeNull();
    expect(charStatuses(state)).toEqual(['pending', 'pending', 'pending']);
  });
});
