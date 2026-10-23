import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levelForSkill } from '@twiper/content';
import { recentDays } from '@twiper/core';
import type { TodayData } from '../../lib/today';
import { ForwardIcon } from '../../ui/icons';
import { levelTitle, skillName } from '../training/levelTitle';

/** strip: 최근 7일과 연속 기록만 / card: 그 아래에 오늘 추천(가장 약한 규칙)을 붙인다 */
export type TodayVariant = 'strip' | 'card';

const fromKey = (day: string) => {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
};

/** 1분 미만은 「1분 미만」, 그 위는 반올림한 분 */
function minutesText(ms: number, t: ReturnType<typeof useTranslation>['t']): string {
  return ms < 60_000
    ? t('today.underMinute')
    : t('today.minutes', { count: Math.round(ms / 60_000) });
}

/**
 * 홈의 「오늘」: 최근 7일 중 연습한 날, 이어진 날 수, 오늘 친 양.
 * 수집·보상 없이 기록만 보여 준다 (계획 §4 동기).
 */
export function Today({ data, variant }: { data: TodayData; variant: TodayVariant }) {
  const { t, i18n } = useTranslation();
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
  const longDay = new Intl.DateTimeFormat(i18n.language, {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const { streak } = data;
  const fresh = data.days.size === 0;

  const headline = fresh
    ? null
    : streak.current > 0
      ? t('today.streak', { count: streak.current })
      : t('today.restart');
  const detail = fresh
    ? t('today.fresh')
    : streak.today
      ? t('today.done', { time: minutesText(data.todayMs, t), chars: data.todayChars })
      : streak.current > 0
        ? t('today.keep', { count: streak.current + 1 })
        : t('today.best', { count: streak.best });

  const weakLevel = data.weakest ? levelForSkill(data.weakest.skill) : undefined;

  return (
    <section
      className={`today${variant === 'card' ? ' is-card' : ''}`}
      aria-label={t('today.title')}
    >
      <div className="today-main">
        <ol className="today-week" aria-label={t('today.week')}>
          {recentDays(data.today).map((day) => {
            const done = data.days.has(day);
            const isToday = day === data.today;
            const date = fromKey(day);
            return (
              <li
                key={day}
                className={`today-day${done ? ' is-done' : ''}${isToday ? ' is-today' : ''}`}
                aria-label={t(done ? 'today.practiced' : 'today.rested', {
                  day: isToday ? t('today.today') : longDay.format(date),
                })}
              >
                <span className="today-dow" aria-hidden="true">
                  {isToday ? t('today.today') : weekday.format(date)}
                </span>
                <span className="today-dot" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
        <p className="today-text">
          {headline ? <strong>{headline}</strong> : null}
          <span>{detail}</span>
        </p>
      </div>
      {variant === 'card' && data.weakest && weakLevel ? (
        <Link className="today-pick" to={`/train/${weakLevel.id}`}>
          <span className="today-pick-label">{t('today.pick')}</span>
          <span className="today-pick-body">
            <span>{t('today.retry', { level: levelTitle(weakLevel, t) })}</span>
            <small>
              {t('today.weak', {
                skill: skillName(data.weakest.skill, t),
                percent: Math.round(data.weakest.accuracy * 100),
              })}
            </small>
          </span>
          <ForwardIcon />
        </Link>
      ) : null}
    </section>
  );
}
