import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { dayKey, type TrainingRepo } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadToday, type TodayData } from '../../lib/today';
import { BackIcon } from '../../ui/icons';
import { fromDayKey } from './Today';

/** first부터 last까지의 달 (YYYY-MM), 최근 달부터 */
function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  const [lastYear = 0, lastMonth = 1] = last.split('-').map(Number);
  for (let i = 0; ; i += 1) {
    const month = dayKey(new Date(lastYear, lastMonth - 1 - i, 1)).slice(0, 7);
    months.push(month);
    if (month <= first) return months;
  }
}

/** 한 달의 날짜를 일요일부터 한 주씩. 달 밖의 칸은 null */
function weeksOf(month: string): (string | null)[][] {
  const [year = 0, mon = 1] = month.split('-').map(Number);
  const length = new Date(year, mon, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: new Date(year, mon - 1, 1).getDay() }, () => null),
    ...Array.from({ length }, (_, i) => dayKey(new Date(year, mon - 1, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

function Month({ month, data }: { month: string; data: TodayData }) {
  const { t, i18n } = useTranslation();
  const title = new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long' }).format(
    fromDayKey(`${month}-01`),
  );
  const narrow = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
  const long = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
  const weeks = weeksOf(month);
  const count = weeks.flat().filter((day) => day !== null && data.days.has(day)).length;

  return (
    <section className="cal-month" aria-label={title}>
      <h2 className="cal-title">
        <span>{title}</span>
        <small>{t('calendar.month', { count })}</small>
      </h2>
      <table className="cal-grid">
        <thead>
          <tr>
            {Array.from({ length: 7 }, (_, i) => {
              // 2023-01-01이 일요일이라 그 주의 날짜로 일요일부터의 요일 이름을 만든다
              const date = new Date(2023, 0, 1 + i);
              return (
                <th key={i} scope="col" abbr={long.format(date)}>
                  {narrow.format(date)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, d) => {
                if (day === null) return <td key={d} />;
                const done = data.days.has(day);
                const classes = [
                  'cal-day',
                  done ? 'is-done' : '',
                  day === data.today ? 'is-today' : '',
                  day > data.today ? 'is-future' : '',
                ].filter(Boolean);
                return (
                  <td key={d}>
                    <span
                      className={classes.join(' ')}
                      aria-current={day === data.today ? 'date' : undefined}
                    >
                      {Number(day.slice(8))}
                      {done ? (
                        <span className="visually-hidden">{t('calendar.practiced')}</span>
                      ) : null}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * 연습한 날 (/calendar): 홈 「오늘」 띠를 누르면 온다. 한 줄이라도 친 날을 달력에 표시한다.
 * 이번 달부터 처음 연습한 달까지, 최근 달이 위에 온다. repo·now는 테스트에서 바꿔 끼운다.
 */
export function CalendarPage({ repo, now }: { repo?: TrainingRepo; now?: Date }) {
  const { t } = useTranslation();
  const [data, setData] = useState<TodayData | null>(null);

  useEffect(() => {
    let alive = true;
    void loadToday(repo ?? trainingRepo(), now).then((loaded) => {
      if (alive) setData(loaded);
    });
    return () => {
      alive = false;
    };
  }, [repo, now]);

  const first = data ? ([...data.days].sort()[0] ?? data.today) : null;

  return (
    <main className="screen" aria-busy={data === null}>
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('calendar.title')}</h1>
      {data && first ? (
        <>
          <p className="screen-body">
            {data.days.size === 0 ? t('calendar.empty') : t('calendar.lead')}
          </p>
          <dl className="stats">
            <div>
              <dt>{t('calendar.current')}</dt>
              <dd>{t('calendar.days', { count: data.streak.current })}</dd>
            </div>
            <div>
              <dt>{t('calendar.best')}</dt>
              <dd>{t('calendar.days', { count: data.streak.best })}</dd>
            </div>
            <div>
              <dt>{t('calendar.total')}</dt>
              <dd>{t('calendar.days', { count: data.days.size })}</dd>
            </div>
          </dl>
          {monthsBetween(first.slice(0, 7), data.today.slice(0, 7)).map((month) => (
            <Month key={month} month={month} data={data} />
          ))}
        </>
      ) : null}
    </main>
  );
}
