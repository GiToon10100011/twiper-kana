import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { DrillSummary, MistakeKind } from '@twiper/core';
import type { Level } from '@twiper/content';
import { levelTitle } from './levelTitle';

/** 다음 레벨을 권하는 첫 시도 정확도 (계획 §10.2). 숙련도 저장이 붙으면 core로 옮긴다 */
const PASS_ACCURACY = 0.9;

interface DrillResultProps {
  title: string;
  summary: DrillSummary;
  /** 같은 레벨의 지난 판. 없거나 아직 읽는 중이면 비교를 보여 주지 않는다 */
  previous?: DrillSummary | null;
  next: Level | undefined;
  onAgain: () => void;
}

/** +4, −3, ±0 */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `\u{2212}${-n}` : '\u{00B1}0');

export function DrillResult({ title, summary, previous, next, onAgain }: DrillResultProps) {
  const { t } = useTranslation();
  const accuracyDelta = previous
    ? Math.round(summary.accuracy * 100) - Math.round(previous.accuracy * 100)
    : null;
  const kpmDelta =
    previous?.kpm != null && summary.kpm !== null
      ? Math.round(summary.kpm) - Math.round(previous.kpm)
      : null;
  const passed = summary.accuracy >= PASS_ACCURACY;
  // 많은 순. 종류를 알 수 없는 '기타'는 맨 뒤
  const kinds = (Object.entries(summary.mistakeKinds) as [MistakeKind, number][])
    .filter(([, count]) => count > 0)
    .sort(([a, x], [b, y]) => Number(a === 'other') - Number(b === 'other') || y - x);
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
          {accuracyDelta === null ? null : (
            <small className="stat-delta">
              {t('result.vsLast', { value: t('result.points', { value: signed(accuracyDelta) }) })}
            </small>
          )}
        </div>
        <div>
          <dt>{t('result.speed')}</dt>
          <dd>{summary.kpm === null ? '–' : Math.round(summary.kpm)}</dd>
          {kpmDelta === null ? null : (
            <small className="stat-delta">{t('result.vsLast', { value: signed(kpmDelta) })}</small>
          )}
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

      {kinds.length > 0 ? (
        <>
          <h2 className="section-label">{t('result.kinds')}</h2>
          <ul className="kind-list">
            {kinds.map(([kind, count]) => (
              <li key={kind}>
                <span>{t(`result.kind.${kind}`)}</span>
                <small>×{count}</small>
              </li>
            ))}
          </ul>
        </>
      ) : null}

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
