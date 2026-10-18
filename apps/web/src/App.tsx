import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { GuideCheck } from './features/lab/GuideCheck';
import { ImeLab } from './features/lab/ImeLab';
import { Onboarding } from './features/onboarding/Onboarding';
import { isOnboarded } from './lib/flags';

function Home() {
  const { t } = useTranslation();
  return (
    <main className="home">
      <h1 className="wordmark">
        twiper<span aria-hidden="true">.</span>
      </h1>
      <p className="lead">{t('home.lead')}</p>
      <Link className="btn btn-primary" to="/onboarding">
        {isOnboarded() ? t('home.redoOnboarding') : t('home.start')}
      </Link>

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
      </ul>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/lab/ime" element={<ImeLab />} />
        <Route path="/lab/guide-check" element={<GuideCheck />} />
      </Routes>
    </BrowserRouter>
  );
}
