import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Toast } from './Toast';

const OFFLINE_READY_MS = 4000;

/** 훈련·튜토리얼 중에는 알림을 띄우지 않는다. 새로고침으로 입력 흐름이 끊기지 않게 (계획 §14) */
const isQuietPath = (path: string) => path.startsWith('/train') || path === '/tutorial';

/**
 * 서비스 워커를 등록하고, 새 버전이 있거나 오프라인 준비가 끝나면 알린다.
 * 새 버전은 사용자가 「업데이트」를 눌렀을 때만 적용한다.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  // iOS Safari는 오래 쓰지 않은 사이트의 저장소를 지울 수 있어 보존을 요청한다 (계획 §13).
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => false);
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_READY_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (isQuietPath(pathname)) return null;
  if (needRefresh) {
    return (
      <Toast
        message={t('pwa.update')}
        action={{ label: t('pwa.reload'), onClick: () => void updateServiceWorker(true) }}
        closeLabel={t('pwa.close')}
        onClose={() => setNeedRefresh(false)}
      />
    );
  }
  if (offlineReady) {
    return (
      <Toast
        message={t('pwa.offlineReady')}
        closeLabel={t('pwa.close')}
        onClose={() => setOfflineReady(false)}
      />
    );
  }
  return null;
}
