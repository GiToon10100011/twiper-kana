import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levels, type Level } from '@twiper/content';
import { ForwardIcon, LockIcon } from '../../ui/icons';
import type { LevelAccess } from './access';
import { levelName, levelPreview, levelSymbol } from './levelTitle';

type Stage = Level['stage'];

const STAGES: readonly Stage[] = ['basic', 'combo'];

const stageOf = (id: string | null): Stage =>
  levels.find((level) => level.id === id)?.stage ?? 'basic';

/**
 * 홈의 코스 목록. 단계를 알약 탭으로 고르고, 각 레벨은 왼쪽 타일에 대표 글자를 크게 둔다.
 * 처음에는 최고 진도(access.current)가 있는 단계를 보여 주고, 그 레벨 하나만 강조한다.
 * 앞 레벨을 끝내야 다음 레벨이 열린다 (설정에서 모두 열 수 있음).
 */
export function CourseTiles({ access }: { access: LevelAccess }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>(() => stageOf(access.current));

  return (
    <>
      <div className="stage-tabs" role="group" aria-label={t('course.stages')}>
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            className="stage-tab"
            aria-pressed={s === stage}
            onClick={() => setStage(s)}
          >
            {t(`course.stage.${s}`)}
          </button>
        ))}
      </div>
      <ol className="tile-list">
        {levels
          .filter((level) => level.stage === stage)
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
