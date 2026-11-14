import { Navigate, Outlet } from 'react-router';
import { isDevMode } from '../../lib/flags';

/** 개발 도구(/lab) 경로를 감싼다. 개발자 모드가 꺼져 있으면 주소로 들어와도 홈으로 돌려보낸다 */
export function DevOnly() {
  return isDevMode() ? <Outlet /> : <Navigate to="/" replace />;
}
