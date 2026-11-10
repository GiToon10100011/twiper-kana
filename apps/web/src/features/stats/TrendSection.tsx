import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dailyTrend,
  trendChange,
  type AttemptRecord,
  type TrendDay,
  type TrendSummary,
} from '@twiper/core';
import { TrendChart } from './TrendChart';

/** 볼 기간 (오늘로 끝나는 날 수) */
export const TREND_PERIODS = [7, 30] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

/** line: 정확도·속도 꺾은선 두 개 / bar: 막대 하나를 정확도·속도로 바꿔 본다 */
export type TrendLayout = 'line' | 'bar';

type Metric = 'accuracy' | 'kpm';

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `\u{2212}${-n}` : '\u{00B1}0');

const percent = (v: number) => `${Math.round(v * 100)}%`;
const whole = (v: number) => String(Math.round(v));

/** 11/9 */
const shortDate = (day: string) => {
  const [, month = '', date = ''] = day.split('-');
  return `${Number(month)}/${Number(date)}`;
};

/**
 * 정확도 축의 범위. 꺾은선은 변화가 보이도록 가장 낮은 값 바로 아래부터 그리고,
 * 막대는 길이로 읽으므로 늘 0%부터 그린다
 */
function accuracyDomain(days: readonly TrendDay[], layout: TrendLayout): [number, number] {
  if (layout === 'bar') return [0, 1];
  const values = days.flatMap((day) => (day.accuracy === null ? [] : [day.accuracy]));
  if (values.length === 0) return [0.5, 1];
  const low = Math.floor(Math.min(...values) * 10) / 10 - 0.1;
  return [Math.max(0, Math.min(0.9, low)), 1];
}

/** 속도 축: 0부터 가장 빠른 날을 넘는 깔끔한 값까지 */
function speedDomain(days: readonly TrendDay[]): [number, number] {
  const top = Math.max(0, ...days.map((day) => day.kpm ?? 0));
  const step = top <= 20 ? 5 : top <= 60 ? 10 : 20;
  return [0, Math.max(step * 2, Math.ceil((top * 1.1) / step) * step)];
}

/**
 * 「내 실력」의 추세: 최근 7일·30일의 첫 시도 정확도와 속도, 그 앞 같은 기간과의 차이, 날마다의 그래프.
 * 점수보다 이전 대비 변화를 먼저 보인다 (계획 §12). attempts는 최근 60일치면 충분하다
 */
export function TrendSection({
  attempts,
  today,
  layout,
}: {
  attempts: readonly AttemptRecord[];
  today: string;
  layout: TrendLayout;
}) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<TrendPeriod>(7);
  const [metric, setMetric] = useState<Metric>('accuracy');

  const days = dailyTrend(attempts, today, period);
  const { current, previous } = trendChange(attempts, today, period);
  const practiced = days.filter((day) => day.lines > 0).length;

  // 지난 기간과의 차이. 두 기간 모두 값이 있어야 비교한다
  const delta = (pick: (s: TrendSummary) => number | null, scale: number, unit = '') => {
    const now = pick(current);
    const before = pick(previous);
    if (now === null || before === null) return t('stats.trend.noPrev', { days: period });
    return t('stats.trend.vsPrev', {
      days: period,
      value: `${signed(Math.round((now - before) * scale))}${unit}`,
    });
  };

  const date = (day: string) => {
    const [, month = '', d = ''] = day.split('-');
    return t('stats.trend.date', { month: Number(month), day: Number(d) });
  };
  const readout = (day: TrendDay, value: string | null) =>
    value === null
      ? t('stats.trend.noPractice', { date: date(day.day) })
      : t('stats.trend.readout', { date: date(day.day), value, count: day.lines });

  // 기간이 바뀌면 고른 날도 처음(마지막으로 연습한 날)으로 돌린다
  const chart = (which: Metric, kind: TrendLayout) => (
    <TrendChart
      key={period}
      days={days}
      value={(day) => (which === 'accuracy' ? day.accuracy : day.kpm)}
      format={which === 'accuracy' ? percent : whole}
      domain={which === 'accuracy' ? accuracyDomain(days, kind) : speedDomain(days)}
      kind={kind}
      label={t(which === 'accuracy' ? 'stats.trend.accuracyChart' : 'stats.trend.speedChart', {
        days: period,
      })}
      readout={readout}
      dateLabel={shortDate}
    />
  );
  const metricName = (which: Metric) =>
    which === 'accuracy' ? t('result.accuracy') : t('stats.trend.speedTitle');

  return (
    <section className="trend">
      <h2 className="section-label">{t('stats.trend.title')}</h2>
      <div className="stage-tabs is-small" role="group" aria-label={t('stats.trend.period')}>
        {TREND_PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            className="stage-tab"
            aria-pressed={option === period}
            onClick={() => setPeriod(option)}
          >
            {t('stats.trend.days', { days: option })}
          </button>
        ))}
      </div>

      {current.lines === 0 ? (
        <p className="screen-body">{t('stats.trend.empty', { days: period })}</p>
      ) : (
        <>
          <dl className="stats trend-stats">
            <div>
              <dt>{t('result.accuracy')}</dt>
              <dd>{current.accuracy === null ? '–' : percent(current.accuracy)}</dd>
              <small className="stat-delta">
                {delta((s) => s.accuracy, 100, t('stats.trend.pointUnit'))}
              </small>
            </div>
            <div>
              <dt>{t('result.speed')}</dt>
              <dd>{current.kpm === null ? '–' : whole(current.kpm)}</dd>
              <small className="stat-delta">{delta((s) => s.kpm, 1)}</small>
            </div>
            <div>
              <dt>{t('stats.trend.practiced')}</dt>
              <dd>{t('stats.trend.dayCount', { count: practiced })}</dd>
              <small className="stat-delta">
                {t('stats.trend.lines', { count: current.lines })}
              </small>
            </div>
          </dl>

          {layout === 'line' ? (
            (['accuracy', 'kpm'] as const).map((which) => (
              <div key={which}>
                <h3 className="trend-chart-title">{metricName(which)}</h3>
                {chart(which, 'line')}
              </div>
            ))
          ) : (
            <>
              <div
                className="stage-tabs is-small trend-metric"
                role="group"
                aria-label={t('stats.trend.metric')}
              >
                {(['accuracy', 'kpm'] as const).map((which) => (
                  <button
                    key={which}
                    type="button"
                    className="stage-tab"
                    aria-pressed={which === metric}
                    onClick={() => setMetric(which)}
                  >
                    {metricName(which)}
                  </button>
                ))}
              </div>
              {chart(metric, 'bar')}
            </>
          )}
        </>
      )}
    </section>
  );
}
