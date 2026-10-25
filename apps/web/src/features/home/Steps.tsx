import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isOnboarded } from '../../lib/flags';
import { BackIcon } from '../../ui/icons';
import { levelAccess } from '../training/access';
import { CourseTiles } from '../training/CourseTiles';

/** 단계별 익히기 (/steps): 아직 칠 줄 모르는 사람을 위한 튜토리얼과 Lv.1부터의 코스 */
export function Steps() {
  const { t } = useTranslation();
  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('steps.title')}</h1>
      <p className="screen-body">{t('steps.lead')}</p>

      {/* PWA는 설치 직후 안내를 강제할 수 없으므로 튜토리얼은 언제든 열 수 있게 둔다. */}
      <ul className="nav-list home-tutorial">
        <li>
          <Link to="/tutorial">
            <span>{t('home.tutorial')}</span>
            <small>{isOnboarded() ? t('home.tutorialHint') : t('home.tutorialFirst')}</small>
          </Link>
        </li>
        <li>
          <Link to="/keys">
            <span>{t('keys.manual')}</span>
            <small>{t('keys.manualHint')}</small>
          </Link>
        </li>
        <li>
          <Link to="/find">
            <span>{t('find.title')}</span>
            <small>{t('find.hint')}</small>
          </Link>
        </li>
      </ul>

      <h2 className="section-label">{t('course.title')}</h2>
      <CourseTiles access={levelAccess()} />

      <h2 className="section-label">{t('home.devTools')}</h2>
      <ul className="nav-list">
        <li>
          <Link to="/lab/ime">
            <span>{t('home.imeLab')}</span>
            <small>{t('home.imeLabHint')}</small>
          </Link>
        </li>
        <li>
          <Link to="/lab/guide-check">
            <span>{t('home.guideCheck')}</span>
            <small>{t('home.guideCheckHint')}</small>
          </Link>
        </li>
        <li>
          <Link to="/lab/course-tiles">
            <span>{t('home.courseTiles')}</span>
            <small>{t('home.courseTilesHint')}</small>
          </Link>
        </li>
        <li>
          <Link to="/lab/ruby">
            <span>{t('home.rubyLab')}</span>
            <small>{t('home.rubyLabHint')}</small>
          </Link>
        </li>
      </ul>
    </main>
  );
}
