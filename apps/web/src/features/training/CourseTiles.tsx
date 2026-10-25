import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levels, type Level } from '@twiper/content';
import { ForwardIcon, LockIcon } from '../../ui/icons';
import type { LevelAccess } from './access';
import { levelName, levelPreview, levelSymbol } from './levelTitle';

/** 단계 탭. all은 모든 단계 */
type StageFilter = Level['stage'] | 'all';

const FILTERS: readonly StageFilter[] = ['all', 'basic', 'combo', 'katakana', 'symbol'];

/**
 * 코스 목록. 단계를 알약 탭으로 고르고, 각 레벨은 왼쪽 타일에 대표 글자를 크게 둔다.
 * 처음에는 「모두」를 보여 준다. 탭이 있는 줄 모르고 첫 단계만 보는 일이 없도록 (사용자 요청 2026-10-24).
 * 최고 진도(access.current) 하나만 강조하고, 앞 레벨을 끝내야 다음 레벨이 열린다 (설정에서 모두 열 수 있음).
 */
export function CourseTiles({ access }: { access: LevelAccess }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<StageFilter>('all');

  return (
    <>
      <div className="stage-tabs is-scroll" role="group" aria-label={t('course.stages')}>
        {FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            className="stage-tab"
            aria-pressed={s === filter}
            onClick={() => setFilter(s)}
          >
            {t(`course.stage.${s}`)}
          </button>
        ))}
      </div>
      <ol className="tile-list">
        {levels
          .filter((level) => filter === 'all' || level.stage === filter)
          .map((level) => (
            <TileItem key={level.id} level={level} access={access} />
          ))}
      </ol>
    </>
  );
}

function TileItem({ level, access }: { level: Level; access: LevelAccess }) {
  const { t } = useTranslation();
  const record = access.progress[level.id];
  const locked = !access.unlocked.has(level.id);
  const isCurrent = access.current === level.id;
  const symbol = levelSymbol(level);
  const status = locked
    ? t('course.locked')
    : record
      ? t('course.best', { accuracy: Math.round(record.bestAccuracy * 100) })
      : isCurrent
        ? t('course.current')
        : null;

  const body = (
    <>
      <span
        className={`tile-mark${Array.from(symbol).length > 1 ? ' is-long' : ''}`}
        lang="ja"
        aria-hidden="true"
      >
        {symbol}
      </span>
      <span className="tile-body">
        <span className="tile-title" lang="ja">
          {levelName(level, t)}
        </span>
        <span className="tile-meta">
          {t('course.level', { number: level.number })}
          <span aria-hidden="true"> · </span>
          <span lang="ja">{levelPreview(level, t)}</span>
        </span>
        {status ? <span className="tile-status">{status}</span> : null}
      </span>
      {locked ? <LockIcon /> : <ForwardIcon />}
    </>
  );

  const className = `tile-item${locked ? ' is-locked' : ''}${isCurrent ? ' is-current' : ''}`;
  return (
    <li className={className}>
      {locked ? (
        <span className="tile-row">{body}</span>
      ) : (
        <Link
          className="tile-row"
          to={`/train/${level.id}`}
          aria-current={isCurrent ? 'step' : undefined}
        >
          {body}
        </Link>
      )}
    </li>
  );
}
