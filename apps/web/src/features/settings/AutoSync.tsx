import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { requestSync } from '../../lib/autoSync';
import { isQuietPath } from '../pwa/quietPath';

/**
 * 자동 동기화 (동기화 설계 §4.5): 앱을 열 때, 앱이 다시 앞으로 왔을 때, 연습 화면을 떠날 때 주고받는다.
 * 연습·테스트·튜토리얼 화면에서는 하지 않는다 (입력 중에 기록이나 설정이 바뀌지 않게). 그리는 것은 없다
 */
export function AutoSync() {
  const { pathname } = useLocation();
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    if (!isQuietPath(pathname)) requestSync();
  }, [pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isQuietPath(path.current)) requestSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
