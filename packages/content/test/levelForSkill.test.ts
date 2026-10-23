import { describe, expect, it } from 'vitest';
import { SKILL_ORDER } from '@twiper/core';
import { levelForSkill } from '../src/index';

describe('levelForSkill', () => {
  it('기본 가나는 그 키의 행별 레벨, 조합·가타카나는 같은 주제의 레벨이다', () => {
    expect(levelForSkill('row:あ')?.id).toBe('L1');
    expect(levelForSkill('row:わ')?.id).toBe('L9');
    expect(levelForSkill('dakuten')?.id).toBe('L11');
    expect(levelForSkill('longVowel')?.id).toBe('L17');
  });

  it('통계에 나오는 모든 규칙에 연습할 레벨이 있다', () => {
    const missing = SKILL_ORDER.filter((skill) => levelForSkill(skill) === undefined);
    expect(missing).toEqual([]);
  });
});
