import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { dayKey, type TrainingRepo } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadToday, type TodayData } from '../../lib/today';
import { BackIcon, ForwardIcon } from '../../ui/icons';
import { fromDayKey } from './Today';

/** 이만큼(px) 이상 옆으로 밀어야 달을 넘긴다. 세로로 더 많이 움직였으면 스크롤로 본다 */
const SWIPE_PX = 48;

/** YYYY-MM에 n달을 더한다 */
function shiftMonth(month: string, n: number): string {
  const [year = 0, mon = 1] = month.split('-').map(Number);
  return dayKey(new Date(year, mon - 1 + n, 1)).slice(0, 7);
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

interface MonthProps {
  month: string;
  data: TodayData;
  /** 넘겨 온 쪽. 1이면 다음 달로(오른쪽에서 들어옴), -1이면 지난달로 */
  from: number;
  canPrev: boolean;
  canNext: boolean;
  onGo: (n: number) => void;
}

/** 한 달 달력. ‹ › 버튼이나 좌우 스와이프로 지난달·다음 달로 넘긴다 */
function Month({ month, data, from, canPrev, canNext, onGo }: MonthProps) {
  const { t, i18n } = useTranslation();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const title = new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long' }).format(
    fromDayKey(`${month}-01`),
  );
  const narrow = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
  const long = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
  const weeks = weeksOf(month);
  const count = weeks.flat().filter((day) => day !== null && data.days.has(day)).length;

  const onTouchStart = (event: TouchEvent) => {
    const point = event.touches[0];
    touch.current = point ? { x: point.clientX, y: point.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch.current;
    const point = event.changedTouches[0];
    touch.current = null;
    if (!start || !point) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 지난달 (책장을 넘기듯)
    onGo(dx < 0 ? 1 : -1);
  };

  return (
    <section
      className="cal-month"
      aria-label={title}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="cal-nav">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('calendar.prev')}
          disabled={!canPrev}
          onClick={() => onGo(-1)}
        >
          <BackIcon />
        </button>
        <h2 className="cal-title" aria-live="polite">
          <span>{title}</span>
          <small>{t('calendar.month', { count })}</small>
        </h2>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('calendar.next')}
          disabled={!canNext}
          onClick={() => onGo(1)}
        >
          <ForwardIcon />
        </button>
      </div>
      <table
        key={month}
        className={`cal-grid${from > 0 ? ' is-from-right' : from < 0 ? ' is-from-left' : ''}`}
      >
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
 * 한 번에 한 달을 보여 주고, 처음 연습한 달부터 이번 달까지 넘겨 볼 수 있다 (사용자 결정 2026-10-24).
 * repo·now는 테스트에서 바꿔 끼운다.
 */
export function CalendarPage({ repo, now }: { repo?: TrainingRepo; now?: Date }) {
  const { t } = useTranslation();
  const [data, setData] = useState<TodayData | null>(null);
  // 보고 있는 달과 넘겨 온 쪽. 처음에는 이번 달
  const [view, setView] = useState<{ month: string; from: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void loadToday(repo ?? trainingRepo(), now).then((loaded) => {
      if (alive) setData(loaded);
    });
    return () => {
      alive = false;
    };
  }, [repo, now]);

  const thisMonth = data?.today.slice(0, 7) ?? '';
  const firstMonth = data ? ([...data.days].sort()[0] ?? data.today).slice(0, 7) : '';
  const month = view?.month ?? thisMonth;
  const go = (n: number) => {
    const next = shiftMonth(month, n);
    if (next < firstMonth || next > thisMonth) return;
    setView({ month: next, from: n });
  };

  return (
    <main className="screen" aria-busy={data === null}>
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('calendar.title')}</h1>
      {data ? (
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
          <Month
            month={month}
            data={data}
            from={view?.from ?? 0}
            canPrev={month > firstMonth}
            canNext={month < thisMonth}
            onGo={go}
          />
        </>
      ) : null}
    </main>
  );
}
