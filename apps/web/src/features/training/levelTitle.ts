import type { TFunction } from 'i18next';
import type { Level } from '@twiper/content';

/** 「さ행」「ら・わ행」「50음 랜덤」「탁음 ゛」 */
export function levelName(level: Level, t: TFunction): string {
  if (level.kind === 'all') return t('course.all');
  if (level.kind === 'combo' && level.topic) return t(`course.topic.${level.topic}`);
  return t('course.row', { keys: level.keys.join('・') });
}

/** 「Lv.3 さ행」 */
export function levelTitle(level: Level, t: TFunction): string {
  return `${t('course.level', { number: level.number })} ${levelName(level, t)}`;
}

/** 목록에 보일 미리보기: 「かきくけこ」「がぎぐげご」「きって・きっぷ」 */
export function levelPreview(level: Level, t: TFunction): string {
  if (level.kind === 'all') return t('course.allHint');
  const { focus, words = [] } = level.drill;
  if (focus.length === 0) return words.slice(0, 2).join('・');
  let preview = '';
  for (const unit of focus) {
    if (Array.from(preview).length >= 5) break;
    preview += unit;
  }
  return preview;
}
