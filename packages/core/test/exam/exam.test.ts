import { describe, expect, it } from 'vitest';
import {
  advanceExam,
  createExam,
  parseExamLine,
  partialLineResult,
  replayInputSession,
  summarizeExam,
  type ExamSource,
  type ExamState,
  type InputSnapshot,
} from '../../src/index';

function snaps(values: string[], composing = true): InputSnapshot[] {
  return values.map((value, i) => ({ t: (i + 1) * 100, value, composing }));
}

/** n줄을 차례로 내 본다 */
function lines(state: ExamState, n: number): string[] {
  const out: string[] = [];
  let current = state;
  for (let i = 0; i < n; i += 1) {
    out.push(current.line.text);
    current = advanceExam(current);
  }
  return out;
}

describe('parseExamLine', () => {
  it('/는 어절 경계다. 목표에서는 빼고, 화면에 틈을 둘 글자 위치로 남긴다', () => {
    expect(parseExamLine('きょうは/いい/てんき。')).toEqual({
      text: 'きょうはいいてんき。',
      gapsAfter: [3, 5],
      judge: 'composing',
    });
  });

  it('가타카나가 있으면 변환해서 確定해야 하므로 commit 판정이다', () => {
    expect(parseExamLine('カメラ').judge).toBe('commit');
    expect(parseExamLine('コーヒー').judge).toBe('commit');
    expect(parseExamLine('さくら').judge).toBe('composing');
  });
});

describe('createExam·advanceExam', () => {
  it('글자: 단위를 lineLength개 섞어 한 줄로 내고, 같은 단위를 바로 붙이지 않는다', () => {
    const source: ExamSource = { mode: 'kana', units: ['あ', 'か', 'きゃ'], lineLength: 5 };
    const out = lines(createExam(source, 1), 30);

    for (const text of out) {
      const units = text.match(/きゃ|あ|か/g) ?? [];
      expect(units).toHaveLength(5);
      units.forEach((unit, i) => expect(unit).not.toBe(units[i - 1]));
    }
  });

  it('같은 씨앗이면 같은 줄이 나온다 (홈의 미리보기와 첫 줄이 같다)', () => {
    const source: ExamSource = { mode: 'word', items: ['さくら', 'カメラ', 'ねこ', 'いぬ'] };

    expect(lines(createExam(source, 42), 10)).toEqual(lines(createExam(source, 42), 10));
  });

  it('단어·짧은 글: 끝없이 내고, 최근에 낸 항목은 곧바로 다시 내지 않는다', () => {
    const items = ['あ/い', 'う/え', 'お/か', 'き/く'];
    const out = lines(createExam({ mode: 'short', items }, 7), 40);

    expect(out).toHaveLength(40);
    out.forEach((text, i) => {
      if (i > 0) expect(text).not.toBe(out[i - 1]);
      if (i > 1) expect(text).not.toBe(out[i - 2]);
    });
  });

  it('긴 글: 글 하나를 처음부터 차례로 내고 다음 줄을 미리 보여 주며, 끝나면 다른 글로 넘어간다', () => {
    const passages = [
      ['あさ/です。', 'ひる/です。', 'よる/です。'],
      ['はる/です。', 'なつ/です。'],
    ];
    let state = createExam({ mode: 'long', passages }, 3);
    const first = passages.find((p) => p[0] && parseExamLine(p[0]).text === state.line.text);
    expect(first).toBeDefined();

    const seen: [string, string | null][] = [];
    for (let i = 0; i < (first?.length ?? 0); i += 1) {
      seen.push([state.line.text, state.upcoming?.text ?? null]);
      state = advanceExam(state);
    }
    const texts = (first ?? []).map((line) => parseExamLine(line).text);
    expect(seen.map(([line]) => line)).toEqual(texts);
    expect(seen.map(([, next]) => next)).toEqual([...texts.slice(1), null]);

    const other = passages.find((p) => p !== first);
    expect(state.line.text).toBe(parseExamLine(other?.[0] ?? '').text);
  });
});

describe('partialLineResult·summarizeExam', () => {
  it('시간이 끝났을 때 치던 줄은 맞게 친 데까지만 센다', () => {
    // あいうえお 중 あい까지 맞게 쳤고, う 자리에 え를 쳐 둔 채 끝남
    const session = replayInputSession('あいうえお', snaps(['あ', 'あい', 'あいえ']));
    const partial = partialLineResult(session, 0);

    expect(partial).toMatchObject({
      target: 'あい',
      units: 2,
      firstTryUnits: 2,
      missedIndexes: [],
    });
  });

  it('속도는 시간 안에 맞게 친 가나 수 ÷ 분, 정확도는 첫 시도로 맞힌 비율', () => {
    const done = replayInputSession('あいう', snaps(['あ', 'あか', 'あ', 'あい', 'あいう']));
    const partial = partialLineResult(replayInputSession('かき', snaps(['か'])), 0);
    const summary = summarizeExam(
      [
        {
          target: 'あいう',
          units: 3,
          firstTryUnits: 2,
          missed: ['い'],
          missedIndexes: [1],
          mistakeKinds: { key: 1 },
          reactionMs: null,
          elapsedMs: null,
          romajiSuspected: false,
          toggleSuspected: false,
        },
      ],
      partial,
      30_000,
    );

    expect(done.errors).toHaveLength(1);
    expect(summary).toMatchObject({
      lines: 1,
      units: 4,
      firstTryUnits: 3,
      accuracy: 0.75,
      kpm: 8,
      durationMs: 30_000,
      mistakeKinds: { key: 1 },
    });
    expect(summary.missed).toEqual([{ char: 'い', count: 1 }]);
  });

  it('아무것도 못 쳤으면 속도 0, 정확도 0', () => {
    expect(summarizeExam([], null, 60_000)).toMatchObject({ units: 0, kpm: 0, accuracy: 0 });
  });
});
