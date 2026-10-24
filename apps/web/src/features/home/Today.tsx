import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { recentDays } from '@twiper/core';
import type { TodayData } from '../../lib/today';
import { ForwardIcon } from '../../ui/icons';

/** YYYY-MM-DD를 기기 시간대의 그날 0시로 */
export const fromDayKey = (day: string) => {
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
 * 홈의 「오늘」 띠: 최근 7일 중 연습한 날, 이어진 날 수, 오늘 친 양.
 * 누르면 연습한 날 달력(/calendar)으로 간다. 수집·보상 없이 기록만 보여 준다 (계획 §4 동기).
 */
export function Today({ data }: { data: TodayData }) {
  const { t, i18n } = useTranslation();
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
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

  // 점 하나하나 대신 요약과 이동할 곳을 읽어 준다. 날짜별 기록은 달력에서 읽는다
  const label = [headline, detail, t('today.open')].filter(Boolean).join(', ');

  return (
    <Link className="today" to="/calendar" aria-label={label}>
      <ol className="today-week" aria-hidden="true">
        {recentDays(data.today).map((day) => {
          const isToday = day === data.today;
          return (
            <li
              key={day}
              className={`today-day${data.days.has(day) ? ' is-done' : ''}${isToday ? ' is-today' : ''}`}
            >
              <span className="today-dow">
                {isToday ? t('today.today') : weekday.format(fromDayKey(day))}
              </span>
              <span className="today-dot" />
            </li>
          );
        })}
      </ol>
      <span className="today-text">
        {headline ? <strong>{headline}</strong> : null}
        <span>{detail}</span>
      </span>
      <ForwardIcon />
    </Link>
  );
}
