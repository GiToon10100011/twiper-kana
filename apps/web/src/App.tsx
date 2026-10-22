import { useCallback, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ExamRoute } from './features/exam/ExamRun';
import { Home } from './features/home/Home';
import { Steps } from './features/home/Steps';
import { Opening } from './features/intro/Opening';
import { CourseTilesLab } from './features/lab/CourseTilesLab';
import { GuideCheck } from './features/lab/GuideCheck';
import { ImeLab } from './features/lab/ImeLab';
import { Onboarding } from './features/onboarding/Onboarding';
import { UpdatePrompt } from './features/pwa/UpdatePrompt';
import { Settings } from './features/settings/Settings';
import { Stats } from './features/stats/Stats';
import { DrillRoute } from './features/training/Drill';

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
          <Route path="/steps" element={<Steps />} />
          <Route path="/test/:mode" element={<ExamRoute />} />
          <Route path="/tutorial" element={<Onboarding />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/train/:levelId" element={<DrillRoute />} />
          <Route path="/lab/ime" element={<ImeLab />} />
          <Route path="/lab/guide-check" element={<GuideCheck />} />
          <Route path="/lab/course-tiles" element={<CourseTilesLab />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
