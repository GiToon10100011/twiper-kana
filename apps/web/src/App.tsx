import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { Opening } from './features/intro/Opening';
import { CourseTilesLab } from './features/lab/CourseTilesLab';
import { GuideCheck } from './features/lab/GuideCheck';
import { HomeLab, StepsLab } from './features/lab/HomeLab';
import { ImeLab } from './features/lab/ImeLab';
import { Onboarding } from './features/onboarding/Onboarding';
import { UpdatePrompt } from './features/pwa/UpdatePrompt';
import { Settings } from './features/settings/Settings';
import { Stats } from './features/stats/Stats';
import { levelAccess } from './features/training/access';
import { CourseTiles } from './features/training/CourseTiles';
import { DrillRoute } from './features/training/Drill';
import { isOnboarded } from './lib/flags';
import { ChartIcon, GearIcon } from './ui/icons';

function Home() {
  const { t } = useTranslation();
  const access = levelAccess();
  return (
    <main className="home">
      <nav className="home-actions">
        <Link className="icon-btn" to="/stats" aria-label={t('home.stats')}>
          <ChartIcon />
        </Link>
        <Link className="icon-btn" to="/settings" aria-label={t('home.settings')}>
          <GearIcon />
        </Link>
      </nav>
      <h1 className="wordmark">
        twiper<span aria-hidden="true">.</span>
      </h1>
      <p className="lead">{t('home.lead')}</p>

      {/* PWA는 설치 직후 안내를 강제할 수 없으므로 튜토리얼은 언제든 열 수 있게 둔다. */}
      <ul className="nav-list home-tutorial">
        <li>
          <Link to="/tutorial">
            <span>{t('home.tutorial')}</span>
            <small>{isOnboarded() ? t('home.tutorialHint') : t('home.tutorialFirst')}</small>
          </Link>
        </li>
      </ul>

      <h2 className="section-label">{t('course.title')}</h2>
      <CourseTiles access={access} />

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
          <Link to="/lab/home-v2">
            <span>{t('home.homeV2')}</span>
            <small>{t('home.homeV2Hint')}</small>
          </Link>
        </li>
      </ul>
    </main>
  );
}

/** 홈으로 앱을 열었을 때만 오프닝을 보여 준다. 다른 주소로 바로 들어오면 건너뛴다 */
const opensAtHome = () => typeof window !== 'undefined' && window.location.pathname === '/';

export function App() {
  const [opening, setOpening] = useState(opensAtHome);
  const finishOpening = useCallback(() => setOpening(false), []);

  return (
    <BrowserRouter>
      {opening ? <Opening onFinish={finishOpening} /> : <UpdatePrompt />}
      {opening ? null : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tutorial" element={<Onboarding />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/train/:levelId" element={<DrillRoute />} />
          <Route path="/lab/ime" element={<ImeLab />} />
          <Route path="/lab/guide-check" element={<GuideCheck />} />
          <Route path="/lab/course-tiles" element={<CourseTilesLab />} />
          <Route path="/lab/home-v2" element={<HomeLab />} />
          <Route path="/lab/home-v2/steps" element={<StepsLab />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
