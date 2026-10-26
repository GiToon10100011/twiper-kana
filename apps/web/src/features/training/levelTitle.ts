import type { TFunction } from 'i18next';
import type { Level, LevelTopic } from '@twiper/content';
import { rubySurface, type SkillId } from '@twiper/core';

/** 통계의 규칙 이름: 「か행」「탁음 ゛」 (레벨 이름과 같은 말을 쓴다) */
export function skillName(skill: SkillId, t: TFunction): string {
  return skill.startsWith('row:')
    ? t('course.row', { keys: skill.slice('row:'.length) })
    : t(`course.topic.${skill as Exclude<SkillId, `row:${string}`>}`);
}

/** 「さ행」「ら・わ행」「50음 랜덤」「탁음 ゛」「짧은 문장」 */
export function levelName(level: Level, t: TFunction): string {
  if (level.kind === 'all') return t('course.all');
  if (level.kind === 'sentence' || level.kind === 'chat') return t(`course.${level.kind}`);
  if (level.topic) return t(`course.topic.${level.topic}`);
  return t('course.row', { keys: level.keys.join('・') });
}

/** 「Lv.3 さ행」 */
export function levelTitle(level: Level, t: TFunction): string {
  return `${t('course.level', { number: level.number })} ${levelName(level, t)}`;
}

/**
 * 목록에 보일 미리보기: 「かきくけこ」「がぎぐげご」「きって・きっぷ」「はい。 ほんとう？」.
 * 한자 표기는 보이는 글자로 바꾼다 ({今日|きょう} → 今日)
 */
export function levelPreview(level: Level, t: TFunction): string {
  if (level.kind === 'all') return t('course.allHint');
  const { focus, words = [] } = level.drill;
  const shown = words.slice(0, 2).map(rubySurface);
  // 문장은 길어서 하나만 보인다 (넘치면 목록에서 말줄임)
  if (level.kind === 'sentence' || level.kind === 'chat') return shown[0] ?? '';
  // 짧은 말에는 ・도 들어 있어서 띄어 쓴다
  if (level.kind === 'phrase') return shown.join(' ');
  if (focus.length === 0) return shown.join('・');
  let preview = '';
  for (const unit of focus) {
    if (Array.from(preview).length >= 5) break;
    preview += unit;
  }
  return preview;
}

/** 조합·가타카나·기호 레벨을 대표하는 글자 */
const TOPIC_SYMBOL: Record<LevelTopic, string> = {
  dakuten: 'が',
  handakuten: 'ぱ',
  small: 'ぁ',
  yoon: 'きゃ',
  sokuon: 'っ',
  katakana: 'カ',
  longVowel: 'ー',
  foreign: 'ティ',
  vu: 'ヴ',
  punct: '？！',
  symbol: '〜',
};

/** 목록 타일에 크게 보일 대표 글자: 「あ」「らわ」「50音」「が」「文」 */
export function levelSymbol(level: Level): string {
  if (level.kind === 'all') return '50音';
  if (level.kind === 'sentence') return '文';
  if (level.kind === 'chat') return '話';
  if (level.topic) return TOPIC_SYMBOL[level.topic];
  return level.keys.join('');
}
