import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { ImeLab } from './features/lab/ImeLab';

function Home() {
  return (
    <main className="home">
      <h1>twiper</h1>
      <p>일본어 가나 플릭 입력 훈련 — 개발 중</p>
      <ul>
        <li>
          <Link to="/lab/ime">IME 스파이크</Link>
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
      </Routes>
    </BrowserRouter>
  );
}
