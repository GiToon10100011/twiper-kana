import type { TFunction } from 'i18next';
import type { Level, LevelTopic } from '@twiper/content';
import { rubySurface, type SkillId } from '@twiper/core';

/** 통계의 규칙 이름: 「か행」「탁음 ゛」 (레벨 이름과 같은 말을 쓴다) */
export function skillName(skill: SkillId, t: TFunction): string {
  return skill.startsWith('row:')
    ? t('course.row', { keys: skill.slice('row:'.length) })
    : t(`course.topic.${skill as Exclude<SkillId, `row:${string}`>}`);
}

/** 「さ행」「ら・わ행」「50음 랜덤」「탁음 ゛」 */
export function levelName(level: Level, t: TFunction): string {
  if (level.kind === 'all') return t('course.all');
  if (level.topic) return t(`course.topic.${level.topic}`);
  return t('course.row', { keys: level.keys.join('・') });
}

/** 「Lv.3 さ행」 */
export function levelTitle(level: Level, t: TFunction): string {
  return `${t('course.level', { number: level.number })} ${levelName(level, t)}`;
}

/** 목록에 보일 미리보기: 「かきくけこ」「がぎぐげご」「きって・きっぷ」「はい。 ほんとう？」「今日・明日」 */
export function levelPreview(level: Level, t: TFunction): string {
  if (level.kind === 'all') return t('course.allHint');
  const { focus, words = [] } = level.drill;
  const shown = words.slice(0, 2).map(rubySurface);
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

/** 조합·가타카나·기호·한자 레벨을 대표하는 글자 */
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
  kanji: '漢',
  noma: '々',
};

/** 목록 타일에 크게 보일 대표 글자: 「あ」「らわ」「50音」「が」 */
export function levelSymbol(level: Level): string {
  if (level.kind === 'all') return '50音';
  if (level.topic) return TOPIC_SYMBOL[level.topic];
  return level.keys.join('');
}
