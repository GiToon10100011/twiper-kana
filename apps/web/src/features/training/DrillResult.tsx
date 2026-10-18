import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { DrillSummary } from '@twiper/core';
import type { Level } from '@twiper/content';
import { levelTitle } from './levelTitle';

/** 다음 레벨을 권하는 첫 시도 정확도 (계획 §10.2). 숙련도 저장이 붙으면 core로 옮긴다 */
const PASS_ACCURACY = 0.9;

interface DrillResultProps {
  title: string;
  summary: DrillSummary;
  next: Level | undefined;
  onAgain: () => void;
}

export function DrillResult({ title, summary, next, onAgain }: DrillResultProps) {
  const { t } = useTranslation();
  const passed = summary.accuracy >= PASS_ACCURACY;
  const seconds = Math.round(summary.totalMs / 1000);
  const time =
    seconds >= 60
      ? t('result.minutes', { min: Math.floor(seconds / 60), sec: seconds % 60 })
      : t('result.seconds', { sec: seconds });

  return (
    <section>
      <h1 className="screen-title">{t('result.title', { level: title })}</h1>
      <dl className="stats">
        <div>
          <dt>{t('result.accuracy')}</dt>
          <dd>{Math.round(summary.accuracy * 100)}%</dd>
        </div>
        <div>
          <dt>{t('result.speed')}</dt>
          <dd>{summary.kpm === null ? '–' : Math.round(summary.kpm)}</dd>
        </div>
        <div>
          <dt>{t('result.time')}</dt>
          <dd>{time}</dd>
        </div>
      </dl>

      <h2 className="section-label">{t('result.missed')}</h2>
      {summary.missed.length > 0 ? (
        <ul className="missed-list" lang="ja">
          {summary.missed.map(({ char, count }) => (
            <li key={char}>
              <span>{char}</span>
              <small>×{count}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="screen-body">{t('result.noMissed')}</p>
      )}

      {summary.romajiSuspected ? <p className="result-warning">{t('result.romaji')}</p> : null}
      {summary.toggleSuspected ? <p className="result-warning">{t('result.toggle')}</p> : null}

      <p className="screen-body">{passed ? t('result.pass') : t('result.practice')}</p>
      <div className="actions">
        {next && passed ? (
          <Link className="btn btn-primary" to={`/train/${next.id}`}>
            {t('result.next', { level: levelTitle(next, t) })}
          </Link>
        ) : null}
        <button
          type="button"
          className={`btn${next && passed ? '' : ' btn-primary'}`}
          onClick={onAgain}
        >
          {t('result.again')}
        </button>
        {next && !passed ? (
          <Link className="btn" to={`/train/${next.id}`}>
            {t('result.next', { level: levelTitle(next, t) })}
          </Link>
        ) : null}
        <Link className="btn-quiet" to="/">
          {t('result.home')}
        </Link>
      </div>
    </section>
  );
}
