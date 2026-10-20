import { describe, expect, it } from 'vitest';
import { frontierLevel, unlockedLevels } from '../../src/index';

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

describe('frontierLevel', () => {
  it('아무것도 끝내지 않았으면 첫 레벨', () => {
    expect(frontierLevel(ORDER, new Set())).toBe('L1');
  });

  it('끝낸 레벨 중 가장 뒤 레벨의 다음 레벨', () => {
    expect(frontierLevel(ORDER, new Set(['L1', 'L2']))).toBe('L3');
  });

  it('앞 레벨을 다시 해도(건너뛴 레벨이 있어도) 가장 뒤 진도를 따른다', () => {
    expect(frontierLevel(ORDER, new Set(['L1', 'L3']))).toBe('L4');
  });

  it('최고 진도는 언제나 열린 레벨이다', () => {
    const cleared = new Set(['L2']);

    expect(unlockedLevels(ORDER, cleared).has(frontierLevel(ORDER, cleared) ?? '')).toBe(true);
  });

  it('마지막 레벨까지 끝냈으면 null', () => {
    expect(frontierLevel(ORDER, new Set(['L4']))).toBeNull();
  });
});
