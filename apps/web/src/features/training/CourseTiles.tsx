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

interface CourseTilesProps {
  access: LevelAccess;
  /** true: 단계를 알약 탭으로 골라 한 단계만 보여 준다 / false: 단계별 제목 아래 모두 보여 준다 */
  tabs?: boolean;
}

/**
 * 코스 목록 시안 (/lab/course-tiles). 왼쪽 타일에 레벨의 대표 글자를 크게 두고,
 * 오른쪽에 이름·레벨·미리보기·기록을 둔다. 홈의 CourseList를 대신할지 사용자가 보고 정한다.
 */
export function CourseTiles({ access, tabs = false }: CourseTilesProps) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>(() => stageOf(access.current));

  if (tabs) {
    return (
      <>
        <div className="stage-tabs" role="group" aria-label={t('course.title')}>
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
        <TileList stage={stage} access={access} />
      </>
    );
  }

  return (
    <>
      {STAGES.map((s) => (
        <section key={s} className="tile-group">
          <h3 className="course-group-title">{t(`course.stage.${s}`)}</h3>
          <TileList stage={s} access={access} />
        </section>
      ))}
    </>
  );
}

function TileList({ stage, access }: { stage: Stage; access: LevelAccess }) {
  return (
    <ol className="tile-list">
      {levels
        .filter((level) => level.stage === stage)
        .map((level) => (
          <TileItem key={level.id} level={level} access={access} />
        ))}
    </ol>
  );
}

function TileItem({ level, access }: { level: Level; access: LevelAccess }) {
  const { t } = useTranslation();
  const record = access.progress[level.id];
  const locked = !access.unlocked.has(level.id);
  const isCurrent = access.current === level.id;
  const symbol = levelSymbol(level);
  const name = levelName(level, t);
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
          {name}
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
