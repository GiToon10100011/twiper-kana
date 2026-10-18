import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levels } from '@twiper/content';
import type { LevelAccess } from './access';
import { levelName } from './levelTitle';

function LockIcon() {
  return (
    <svg className="course-lock" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** 홈의 레벨 목록. 앞 레벨을 끝내야 다음 레벨이 열린다 (설정에서 모두 열 수 있음). */
export function CourseList({ access }: { access: LevelAccess }) {
  const { t } = useTranslation();
  return (
    <ol className="nav-list course-list">
      {levels.map((level) => {
        const record = access.progress[level.id];
        const label = t('course.level', { number: level.number });
        const name = levelName(level, t);
        const hint = level.kind === 'all' ? t('course.allHint') : level.drill.focus.join('');

        if (!access.unlocked.has(level.id)) {
          return (
            <li key={level.id} className="is-locked">
              <span className="course-row" aria-label={`${label} ${name} ${t('course.locked')}`}>
                <span className="course-level">{label}</span>
                <span className="course-name" lang="ja">
                  {name}
                </span>
                <LockIcon />
              </span>
            </li>
          );
        }

        const isCurrent = access.current === level.id;
        return (
          <li key={level.id} className={isCurrent ? 'is-current' : undefined}>
            <Link to={`/train/${level.id}`} aria-current={isCurrent ? 'step' : undefined}>
              <span className="course-level">{label}</span>
              <span className="course-name" lang="ja">
                {name}
              </span>
              {record ? (
                <small>
                  {t('course.best', { accuracy: Math.round(record.bestAccuracy * 100) })}
                </small>
              ) : (
                <small lang="ja">{hint}</small>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
