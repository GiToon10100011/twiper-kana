import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isQuietPath } from './quietPath';
import { Toast } from './Toast';

/**
 * 서비스 워커를 등록하고, 새 버전이 있으면 알린다.
 * 새 버전은 사용자가 「업데이트」를 눌렀을 때만 적용한다.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // iOS Safari는 오래 쓰지 않은 사이트의 저장소를 지울 수 있어 보존을 요청한다 (계획 §13).
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => false);
  }, []);

  if (!needRefresh || isQuietPath(pathname)) return null;
  return (
    <Toast
      message={t('pwa.update')}
      action={{ label: t('pwa.reload'), onClick: () => void updateServiceWorker(true) }}
      closeLabel={t('pwa.close')}
      onClose={() => setNeedRefresh(false)}
    />
  );
}
