import type { TFunction } from 'i18next';
import type { Level } from '@twiper/content';

/** 「さ행」「ら・わ행」「50음 랜덤」 */
export function levelName(level: Level, t: TFunction): string {
  return level.kind === 'all' ? t('course.all') : t('course.row', { keys: level.keys.join('・') });
}

/** 「Lv.3 さ행」 */
export function levelTitle(level: Level, t: TFunction): string {
  return `${t('course.level', { number: level.number })} ${levelName(level, t)}`;
}
