import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isDevMode, setDevMode } from '../../lib/flags';

/** 「버전」을 이만큼 잇달아 누르면 개발자 모드를 켜고 끈다 */
export const DEV_MODE_TAPS = 7;

/** 누름 사이가 이보다 길면 처음부터 다시 센다 */
export const DEV_MODE_TAP_GAP_MS = 1500;

/** 남은 횟수가 이만큼 이하일 때부터 알려 준다 */
const COUNTDOWN_FROM = 3;

/** 「1.0.0 (b46f492)」. 빌드 번호가 없으면(로컬 빌드) 버전만 */
const VERSION_LABEL = __APP_BUILD__ ? `${__APP_VERSION__} (${__APP_BUILD__})` : __APP_VERSION__;

/** 설정 맨 아래의 앱 정보. 「버전」을 7번 누르면 개발자 모드가 켜지고, 다시 7번 누르면 꺼진다 */
export function AboutSection({ now = Date.now }: { readonly now?: () => number }) {
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

  const hint = message ?? (devMode ? t('settings.devModeActive') : null);
  return (
    <>
      <h2 className="section-label">{t('settings.about')}</h2>
      <ul className="nav-list settings-list">
        <li>
          <button type="button" className="setting-row setting-tap" onClick={onTap}>
            <span>
              <span className="setting-name">{t('settings.version')}</span>
              <small aria-live="polite">{hint}</small>
            </span>
            <span className="setting-value">{VERSION_LABEL}</span>
          </button>
        </li>
      </ul>
    </>
  );
}
