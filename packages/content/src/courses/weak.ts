import { tokenizeKana, type DrillSpec, type SkillId } from '@twiper/core';
import { dakutenWords, handakutenWords, sokuonWords, yoonWords } from '../words/combos';
import { hiraganaWords } from '../words/hiragana';
import { levels, type Level } from './levels';

/** 약점 연습 단어: 조합 중에 맞으면 넘어가는 히라가나 단어만 (가타카나는 바꿔야 해서 뺀다) */
const PRACTICE_WORDS: readonly string[] = [
  ...new Set([...hiraganaWords, ...dakutenWords, ...handakutenWords, ...yoonWords, ...sokuonWords]),
];

/**
 * 약점 연습 한 판 (계획 §12 Weakness Analyzer → 추천 훈련).
 * 약점 단위(weakUnits)를 글자 줄로 섞어 내고, 그 단위가 든 히라가나 단어를 번갈아 낸다.
 * 레벨처럼 틀린 단위는 몇 줄 뒤에 다시 낸다
 */
export function weakDrill(units: readonly string[]): DrillSpec {
  const words = PRACTICE_WORDS.filter((word) =>
    tokenizeKana(word).some((unit) => units.includes(unit)),
  );
  return {
    focus: units,
    review: [],
    ...(words.length > 0 ? { words } : {}),
    lineLength: 5,
    lineCount: 8,
    reviewRatio: 0,
  };
}

/**
 * 규칙(통계의 skill)을 익히는 레벨: 행(row:か)은 그 키의 행별 레벨, 조합·가타카나·기호 규칙은 그 주제 레벨.
 * 가장 약한 규칙에서 「그 단계로 돌아가기」에 쓴다
 */
export function levelForSkill(skill: SkillId): Level | undefined {
  if (skill.startsWith('row:')) {
    const key = skill.slice('row:'.length);
    return levels.find((level) => level.kind === 'row' && level.keys.includes(key));
  }
  return levels.find((level) => level.topic === skill);
}
