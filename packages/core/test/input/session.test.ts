import { describe, expect, it } from 'vitest';
import {
  charStatuses,
  createInputSession,
  pendingStep,
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

  it('끝 글자가 아직 목표로 바뀔 수 있으면 보류 표시한다', () => {
    expect(charStatuses(replayInputSession('がぎ', snaps(['が', 'がき'])))).toEqual([
      'correct',
      'pending',
    ]);
    expect(charStatuses(replayInputSession('づ', snaps(['っ'])))).toEqual(['pending']);
    expect(charStatuses(replayInputSession('か', snaps(['k'])))).toEqual(['pending']);
  });

  it('끝 글자가 목표로 바뀔 수 없으면 바로 오타로 표시하되, 오류 기록은 확정될 때까지 미룬다', () => {
    const state = replayInputSession('あい', snaps(['あ', 'あう']));

    expect(charStatuses(state)).toEqual(['correct', 'wrong']);
    expect(state.errors).toEqual([]);
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

  it('조합 중에는 읽기로 맞춰 본다: かめ는 カメ까지 맞은 것이고, 읽기를 다 치면 변환을 기다린다', () => {
    const typing = replayInputSession('カメラ', snaps(['か', 'かめ']), 'commit');

    expect(charStatuses(typing)).toEqual(['correct', 'correct', 'todo']);
    expect(typing.matched).toBe(2);
    expect(pendingStep(typing)).toBeNull();

    const read = reduceInputSession(typing, { t: 300, value: 'かめら', composing: true });

    expect(pendingStep(read)).toBe('convert');
    expect(read.unitTimes).toEqual([100, 200, 300]);

    const candidate = reduceInputSession(read, { t: 400, value: 'カメラ', composing: true });

    expect(pendingStep(candidate)).toBe('commit');
    expect(candidate.errors).toEqual([]);
  });

  it('읽기를 잘못 치면 composing 판정처럼 오류로 기록한다', () => {
    const state = replayInputSession('カメラ', snaps(['か', 'かま', 'かまら']), 'commit');

    expect(state.errors).toEqual([
      { index: 1, expected: 'メ', actual: 'ま', cause: 'continued', t: 300 },
    ]);
    expect(charStatuses(state)).toEqual(['correct', 'wrong', 'correct']);
  });

  it('히라가나 그대로 確定하면 완료되지 않고, 확정한 글자를 한 번만 오답으로 기록한다', () => {
    const typed = replayInputSession('カメラ', snaps(['か', 'かめ', 'かめら']), 'commit');
    const committed = reduceInputSession(typed, { t: 400, value: 'かめら', composing: false });

    expect(committed.completedAt).toBeNull();
    expect(committed.errors.map((e) => [e.index, e.actual, e.cause])).toEqual([
      [0, 'か', 'committed'],
      [1, 'め', 'committed'],
      [2, 'ら', 'committed'],
    ]);
    expect(charStatuses(committed)).toEqual(['wrong', 'wrong', 'wrong']);
    expect(pendingStep(committed)).toBe('fix');

    // 지우고 다시 쳐서 변환하면 완료된다. 지운 글자를 또 세지 않는다.
    const fixed = [
      { t: 500, value: 'かめ', composing: false },
      { t: 600, value: '', composing: false },
      { t: 700, value: 'か', composing: true },
      { t: 800, value: 'かめら', composing: true },
      { t: 900, value: 'カメラ', composing: false },
    ].reduce(reduceInputSession, committed);

    expect(fixed.errors).toHaveLength(3);
    expect(fixed.completedAt).toBe(900);
  });

  it('한자 후보를 고르는 동안에는 오류를 세지 않고, 한자로 確定하면 기록한다', () => {
    const browsing = replayInputSession(
      'カメラ',
      snaps(['か', 'かめら', '亀等', 'カメラ']),
      'commit',
    );

    expect(browsing.errors).toEqual([]);

    const wrong = reduceInputSession(
      replayInputSession('カメラ', snaps(['かめら', '亀等']), 'commit'),
      {
        t: 300,
        value: '亀等',
        composing: false,
      },
    );

    expect(wrong.errors.map((e) => [e.expected, e.actual, e.cause])).toEqual([
      ['カ', '亀', 'committed'],
      ['メ', '等', 'committed'],
    ]);
  });

  it('반각 가타카나 후보를 고르는 동안에도 오류를 세지 않는다', () => {
    const browsing = replayInputSession(
      'カメラ',
      snaps(['かめら', '\u{FF76}\u{FF92}\u{FF97}', 'カメラ']),
      'commit',
    );

    expect(browsing.errors).toEqual([]);
    expect(charStatuses(browsing)).toEqual(['correct', 'correct', 'correct']);
  });

  it('조합 중 라틴 문자는 후보로 보지 않고 로마자 키보드로 추정한다', () => {
    const state = replayInputSession('カメラ', snaps(['k', 'ka', 'かm']), 'commit');

    expect(state.romajiSuspected).toBe(true);
  });

  it('장음 자리에 모음을 치면 오류로 기록한다', () => {
    const state = replayInputSession('コーヒー', snaps(['こ', 'こう', 'こうひ']), 'commit');

    expect(state.errors).toEqual([
      { index: 1, expected: 'ー', actual: 'う', cause: 'continued', t: 300 },
    ]);
  });

  it('앞부분을 맞게 확정하고 이어 쳐도 오류가 아니다', () => {
    const state = [
      { t: 100, value: 'かめ', composing: true },
      { t: 200, value: 'カメ', composing: false },
      { t: 300, value: 'カメら', composing: true },
      { t: 400, value: 'カメラ', composing: false },
    ].reduce(reduceInputSession, createInputSession('カメラ', 'commit'));

    expect(state.errors).toEqual([]);
    expect(state.completedAt).toBe(400);
  });
});

describe('InputSession — 한자 표기 {表記|よみ}', () => {
  const at = (t: number, value: string, composing: boolean): InputSnapshot => ({
    t,
    value,
    composing,
  });
  /** 時々의 읽기 ときどき를 플릭으로 다 친 상태 (100–400ms) */
  const readTokidoki = () =>
    replayInputSession('{時々|ときどき}', snaps(['と', 'とき', 'ときど', 'ときどき']), 'commit');

  it('목표는 읽기로 펼쳐 맞춰 보고, 읽기를 다 치면 변환을 기다린다', () => {
    const state = readTokidoki();

    expect(state.target).toEqual(['と', 'き', 'ど', 'き']);
    expect(state.surface).toEqual(['時', '々']);
    expect(state.errors).toEqual([]);
    expect(state.matched).toBe(4);
    expect(charStatuses(state)).toEqual(['correct', 'correct', 'correct', 'correct']);
    expect(state.converted).toEqual([false]);
    expect(pendingStep(state)).toBe('convert');
  });

  it('후보에서 표기를 고르면 確定을 기다리고, 確定하면 완료된다', () => {
    const candidate = reduceInputSession(readTokidoki(), at(500, '時々', true));

    expect(candidate.value).toEqual(['と', 'き', 'ど', 'き']);
    expect(candidate.raw).toEqual(['時', '々']);
    expect(candidate.converted).toEqual([true]);
    expect(pendingStep(candidate)).toBe('commit');

    const committed = reduceInputSession(candidate, at(600, '時々', false));
    expect(committed.completedAt).toBe(600);
    expect(committed.matchedAt).toBe(600);
    expect(committed.errors).toEqual([]);
    expect(committed.unitTimes).toEqual([100, 200, 300, 400]);
  });

  it('변환하지 않고 읽기 그대로 確定하면 그 표기 자리에 한 번 기록하고 고치기를 기다린다', () => {
    const committed = reduceInputSession(readTokidoki(), at(500, 'ときどき', false));
    const again = reduceInputSession(committed, at(600, 'ときどき', false));

    expect(again.completedAt).toBeNull();
    expect(pendingStep(again)).toBe('fix');
    expect(again.errors).toEqual([
      { index: 0, expected: '時々', actual: 'ときどき', cause: 'committed', t: 500 },
    ]);
  });

  it('다른 한자를 고르는 동안에는 기록하지 않고, 그대로 確定하면 틀린 변환으로 기록한다', () => {
    const other = reduceInputSession(readTokidoki(), at(500, '時時', true));

    expect(other.errors).toEqual([]);
    expect(other.converted).toEqual([false]);
    expect(pendingStep(other)).toBeNull();

    const committed = reduceInputSession(other, at(600, '時時', false));
    expect(committed.completedAt).toBeNull();
    expect(committed.errors.map((e) => [e.index, e.expected, e.actual])).toEqual([
      [0, 'と', '時'],
      [1, 'き', '時'],
    ]);
  });

  it('읽기를 잘못 치면 가나 목표처럼 오류로 기록한다', () => {
    const state = replayInputSession('{時々|ときどき}', snaps(['と', 'とけ', 'とけど']), 'commit');

    expect(state.errors).toEqual([
      { index: 1, expected: 'き', actual: 'け', cause: 'continued', t: 300 },
    ]);
  });

  it('한자를 바르게 確定한 뒤 이어 치는 가나도 틀리면 기록한다 (확정한 한자를 후보로 보지 않는다)', () => {
    const state = [
      at(100, 'ときどき', true),
      at(200, '時々', true),
      at(300, '時々', false),
      at(400, '時々わ', true),
      at(500, '時々わ', false),
    ].reduce(reduceInputSession, createInputSession('{時々|ときどき}は', 'commit'));

    expect(state.target.join('')).toBe('ときどきは');
    expect(state.errors).toEqual([
      { index: 4, expected: 'は', actual: 'わ', cause: 'committed', t: 500 },
    ]);
    expect(pendingStep(state)).toBe('fix');
  });

  it('표기가 둘이면 각각 변환한 것을 따로 센다', () => {
    const start = createInputSession('{今日|きょう}は{雨|あめ}', 'commit');
    const state = [at(100, '今日', false), at(200, '今日はあめ', true)].reduce(
      reduceInputSession,
      start,
    );

    expect(state.value.join('')).toBe('きょうはあめ');
    expect(state.converted).toEqual([true, false]);
    expect(pendingStep(state)).toBe('convert');
  });
});

describe('pendingStep — composing 판정', () => {
  it('조합 중 일치하면 確定을 기다린다', () => {
    const state = replayInputSession('あい', snaps(['あ', 'あい']), 'composing', {
      completeOnCommit: true,
    });

    expect(pendingStep(state)).toBe('commit');
    expect(
      pendingStep(reduceInputSession(state, { t: 300, value: 'あい', composing: false })),
    ).toBeNull();
  });
});
