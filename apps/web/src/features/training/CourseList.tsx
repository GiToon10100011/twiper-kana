import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levels } from '@twiper/content';
import { levelName } from './levelTitle';

/** 홈의 레벨 목록. 잠그지 않고 어느 레벨이든 바로 들어갈 수 있다 (계획 §7 소프트 잠금). */
export function CourseList() {
  const { t } = useTranslation();
  return (
    <ol className="nav-list course-list">
      {levels.map((level) => (
        <li key={level.id}>
          <Link to={`/train/${level.id}`}>
            <span className="course-level">{t('course.level', { number: level.number })}</span>
            <span className="course-name" lang="ja">
              {levelName(level, t)}
            </span>
            <small lang="ja">
              {level.kind === 'all' ? t('course.allHint') : level.drill.focus.join('')}
            </small>
          </Link>
        </li>
      ))}
    </ol>
  );
}
