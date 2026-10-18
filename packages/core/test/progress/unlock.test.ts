import { describe, expect, it } from 'vitest';
import { currentLevel, unlockedLevels } from '../../src/index';

const ORDER = ['L1', 'L2', 'L3', 'L4'];

describe('unlockedLevels', () => {
  it('처음에는 첫 레벨만 열려 있다', () => {
    expect([...unlockedLevels(ORDER, new Set())]).toEqual(['L1']);
  });

  it('끝낸 레벨의 다음 레벨이 열린다', () => {
    expect([...unlockedLevels(ORDER, new Set(['L1', 'L2']))]).toEqual(['L1', 'L2', 'L3']);
  });

  it('모두 열기를 켜면 전부 열린다', () => {
    expect([...unlockedLevels(ORDER, new Set(), true)]).toEqual(ORDER);
  });

  it('모두 열기로 먼저 끝낸 레벨은 끈 뒤에도 열려 있고, 그 다음 레벨도 열린다', () => {
    expect([...unlockedLevels(ORDER, new Set(['L3']))]).toEqual(['L1', 'L3', 'L4']);
  });
});

describe('currentLevel', () => {
  it('열린 레벨 중 아직 끝내지 않은 첫 레벨', () => {
    const cleared = new Set(['L1']);

    expect(currentLevel(ORDER, cleared, unlockedLevels(ORDER, cleared))).toBe('L2');
  });

  it('모두 끝냈으면 null', () => {
    const cleared = new Set(ORDER);

    expect(currentLevel(ORDER, cleared, unlockedLevels(ORDER, cleared))).toBeNull();
  });
});
