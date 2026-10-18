import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { GuideCheck } from './features/lab/GuideCheck';
import { ImeLab } from './features/lab/ImeLab';

function Home() {
  return (
    <main className="home">
      <h1 className="wordmark">
        twiper<span aria-hidden="true">.</span>
      </h1>
      <p className="lead">실제 키보드로 익히는 일본어 플릭 입력</p>

      <h2 className="section-label">개발 도구</h2>
      <ul className="nav-list">
        <li>
          <Link to="/lab/ime">
            <span>IME 스파이크</span>
            <small>입력 흐름 확인</small>
          </Link>
        </li>
        <li>
          <Link to="/lab/guide-check">
            <span>키보드 가이드 확인</span>
            <small>키 배치 대조</small>
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
        <Route path="/lab/ime" element={<ImeLab />} />
        <Route path="/lab/guide-check" element={<GuideCheck />} />
      </Routes>
    </BrowserRouter>
  );
}
