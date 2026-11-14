import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isDevMode, setDevMode } from '../../lib/flags';

/** 버전 글씨를 이만큼 잇달아 누르면 개발자 모드를 켜고 끈다 */
export const DEV_MODE_TAPS = 7;

/** 누름 사이가 이보다 길면 처음부터 다시 센다 */
export const DEV_MODE_TAP_GAP_MS = 1500;

/** 남은 횟수가 이만큼 이하일 때부터 알려 준다 */
const COUNTDOWN_FROM = 3;

/** 「twiper 1.0.0 (b46f492)」. 빌드 번호가 없으면(로컬 빌드) 버전만 */
export const VERSION_LABEL = `twiper ${__APP_VERSION__}${__APP_BUILD__ ? ` (${__APP_BUILD__})` : ''}`;

/**
 * 설정 맨 아래의 버전 (회색 글씨). 버튼처럼 보이지 않고 눌러도 반응이 없지만, 7번 잇달아 누르면
 * 개발자 모드가 켜지고 다시 7번 누르면 꺼진다
 */
export function VersionFooter({ now = Date.now }: { readonly now?: () => number }) {
  const { t } = useTranslation();
  const [devMode, setDevModeState] = useState(isDevMode);
  const [message, setMessage] = useState<string | null>(null);
  const taps = useRef({ count: 0, at: 0 });

  const onTap = () => {
    const at = now();
    const count = at - taps.current.at <= DEV_MODE_TAP_GAP_MS ? taps.current.count + 1 : 1;
    if (count >= DEV_MODE_TAPS) {
      const next = !devMode;
      taps.current = { count: 0, at: 0 };
      // 적지 못하면 실제 상태가 그대로이므로 화면도 그대로 두고 알린다
      if (!setDevMode(next)) {
        setMessage(t('settings.devModeNotSaved'));
        return;
      }
      setDevModeState(next);
      setMessage(t(next ? 'settings.devModeOn' : 'settings.devModeOff'));
      return;
    }
    taps.current = { count, at };
    const left = DEV_MODE_TAPS - count;
    setMessage(
      left <= COUNTDOWN_FROM
        ? t(devMode ? 'settings.devModeOffIn' : 'settings.devModeOnIn', { count: left })
        : null,
    );
  };

  const note = message ?? (devMode ? t('settings.devModeActive') : null);
  return (
    <footer className="settings-footer">
      <p className="settings-version" onClick={onTap}>
        {VERSION_LABEL}
      </p>
      <p className="settings-footer-note" aria-live="polite">
        {note}
      </p>
    </footer>
  );
}
