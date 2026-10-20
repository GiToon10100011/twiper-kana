import { describe, expect, it } from 'vitest';
import {
  confusions,
  skillsOf,
  skillStats,
  slowUnits,
  type AttemptFlag,
  type AttemptRecord,
  type MistakeKind,
} from '../../src/index';

let serial = 0;

/** 시도 기록 한 건. mistakes는 [위치, 친 글자, 종류] */
function attempt(
  target: string,
  unitMs: (number | null)[],
  mistakes: [number, string, MistakeKind?][] = [],
  flags: AttemptFlag[] = [],
): AttemptRecord {
  serial += 1;
  const chars = Array.from(target);
  return {
    id: `A${String(serial).padStart(4, '0')}`,
    sessionId: 'S1',
    levelId: 'L1',
    at: new Date(Date.UTC(2026, 9, 21, 0, 0, serial)).toISOString(),
    target,
    input: target,
    result: mistakes.length === 0 ? 'correct' : 'corrected',
    judge: 'composing',
    reactionMs: null,
    elapsedMs: null,
    unitMs,
    mistakes: mistakes.map(([index, actual, kind]) => ({
      index,
      expected: chars[index] ?? '',
      actual,
      cause: 'continued',
      ...(kind ? { kind } : {}),
    })),
    corrections: new Set(mistakes.map(([index]) => index)).size,
    flags,
  };
}

describe('skillsOf', () => {
  it('기본 가나는 그 키의 행, 변형·요음·촉음·장음은 각 규칙', () => {
    expect(skillsOf('か')).toEqual(['row:か']);
    expect(skillsOf('を')).toEqual(['row:わ']);
    expect(skillsOf('が')).toEqual(['dakuten']);
    expect(skillsOf('ゔ')).toEqual(['dakuten']);
    expect(skillsOf('ぱ')).toEqual(['handakuten']);
    expect(skillsOf('ぁ')).toEqual(['small']);
    expect(skillsOf('っ')).toEqual(['sokuon']);
    expect(skillsOf('きゃ')).toEqual(['yoon']);
    expect(skillsOf('ぎゃ')).toEqual(['yoon', 'dakuten']);
    expect(skillsOf('ー')).toEqual(['longVowel']);
  });

  it('가타카나는 가타카나에 더해 같은 읽기의 규칙에도 센다', () => {
    expect(skillsOf('カ')).toEqual(['katakana', 'row:か']);
    expect(skillsOf('ン')).toEqual(['katakana', 'row:わ']);
    expect(skillsOf('キャ')).toEqual(['katakana', 'yoon']);
    expect(skillsOf('ッ')).toEqual(['katakana', 'sokuon']);
  });

  it('가나가 아니면 어떤 규칙에도 넣지 않는다', () => {
    expect(skillsOf('、')).toEqual([]);
    expect(skillsOf('')).toEqual([]);
  });
});

describe('skillStats', () => {
  it('규칙마다 첫 시도 정확도와, 줄 첫 글자를 뺀 글자당 시간의 중앙값을 낸다', () => {
    const stats = skillStats([
      attempt('かきが', [900, 300, 500]),
      attempt('くけ', [800, 400], [[1, 'こ']]),
    ]);
    const ka = stats.find((s) => s.skill === 'row:か');

    expect(ka).toEqual({
      skill: 'row:か',
      samples: 4,
      firstTry: 3,
      accuracy: 0.75,
      // 줄 첫 글자(か 900, く 800)는 문제를 읽는 시간이 섞여 빼고, き 300·け 400
      medianMs: 350,
    });
    expect(stats.find((s) => s.skill === 'dakuten')).toMatchObject({ samples: 1, firstTry: 1 });
    expect(stats.map((s) => s.skill)).toEqual(['row:か', 'dakuten']);
  });

  it('요음은 두 글자 시간을 더하고, 한 글자라도 틀리면 틀린 것으로 센다', () => {
    const yoon = skillStats([attempt('あきゃ', [500, 300, 200], [[2, 'や']])]).find(
      (s) => s.skill === 'yoon',
    );

    expect(yoon).toEqual({ skill: 'yoon', samples: 1, firstTry: 0, accuracy: 0, medianMs: 500 });
  });

  it('변환하지 않은 실수(script·conversion)는 가타카나에만 센다', () => {
    const stats = skillStats([
      attempt(
        'カメ',
        [700, 300],
        [
          [0, 'か', 'script'],
          [1, 'め', 'script'],
        ],
      ),
    ]);

    expect(stats.find((s) => s.skill === 'katakana')).toMatchObject({ samples: 2, firstTry: 0 });
    expect(stats.find((s) => s.skill === 'row:か')).toMatchObject({ samples: 1, firstTry: 1 });
    expect(stats.find((s) => s.skill === 'row:ま')).toMatchObject({ samples: 1, firstTry: 1 });
  });

  it('kind가 없는 예전 기록은 글자 쌍으로 다시 분류한다', () => {
    const stats = skillStats([attempt('カ', [500], [[0, 'か']])]);

    expect(stats.find((s) => s.skill === 'row:か')).toMatchObject({ firstTry: 1 });
    expect(stats.find((s) => s.skill === 'katakana')).toMatchObject({ firstTry: 0 });
  });

  it('규칙마다 최근 window번만 본다', () => {
    const old = attempt('あ', [500], [[0, 'い']]);
    const recent = attempt('あ', [500]);

    expect(skillStats([old, recent], { window: 1 })[0]).toMatchObject({ samples: 1, firstTry: 1 });
    // 넘긴 순서와 무관하게 시각으로 최근을 고른다
    expect(skillStats([recent, old], { window: 1 })[0]).toMatchObject({ firstTry: 1 });
  });

  it('로마자 키보드로 친 줄은 통계에서 뺀다', () => {
    expect(skillStats([attempt('あ', [500], [], ['romaji-suspected'])])).toEqual([]);
  });

  it('목표보다 길게 친 초과분은 어떤 글자의 실수로도 세지 않는다', () => {
    const [a] = skillStats([attempt('あ', [500], [[1, 'い', 'extra']])]);

    expect(a).toMatchObject({ samples: 1, firstTry: 1 });
  });
});

describe('confusions', () => {
  it('자주 틀린 글자 쌍을 많은 순으로, 같으면 최근 순으로 낸다', () => {
    const list = confusions([
      attempt('がか', [0, 0], [[0, 'か']]),
      attempt('きが', [0, 0], [[1, 'か']]),
      attempt('え', [0], [[0, 'う']]),
    ]);

    expect(list).toEqual([
      { expected: 'が', actual: 'か', count: 2 },
      { expected: 'え', actual: 'う', count: 1 },
    ]);
  });

  it('변환하지 않은 것과 초과 입력은 글자 혼동이 아니므로 뺀다', () => {
    const list = confusions([
      attempt('カ', [0], [[0, 'か', 'script']]),
      attempt('あ', [0], [[1, 'い', 'extra']]),
    ]);

    expect(list).toEqual([]);
  });
});

describe('slowUnits', () => {
  it('표본이 충분한 글자 중 느린 순으로, 가타카나는 읽기로 묶어 낸다', () => {
    const list = slowUnits(
      [
        attempt('あかき', [9000, 400, 900]),
        attempt('あカき', [9000, 600, 1100]),
        attempt('あかし', [9000, 500, 200]),
      ],
      { minSamples: 2 },
    );

    expect(list).toEqual([
      { unit: 'き', medianMs: 1000, samples: 2 },
      { unit: 'か', medianMs: 500, samples: 3 },
    ]);
  });
});
