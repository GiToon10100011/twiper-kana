import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { applyLanguage } from '../../i18n';
import type { LanguageChoice } from '../../i18n/locale';
import {
  HELP_IDLE_CHOICES,
  loadSettings,
  saveSettings,
  SPEED_UNITS,
  type Settings as SettingsValue,
} from '../../lib/settings';
import { BackIcon } from '../../ui/icons';
import { Pills } from '../../ui/Pills';
import { BackupSection } from './BackupSection';
import { SyncSettings } from './SyncSettings';

/** 언어 이름은 그 언어로 적는다 (지금 화면 언어를 읽지 못해도 자기 언어를 찾을 수 있게) */
const LANGUAGE_NAMES: readonly (readonly [Exclude<LanguageChoice, 'auto'>, string])[] = [
  ['ko', '한국어'],
  ['ja', '日本語'],
  ['en', 'English'],
];

export function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(loadSettings);

  const update = (next: SettingsValue) => {
    setSettings(next);
    saveSettings(next);
  };

  /** 「30초」「3분」「끄기」 */
  const idleLabel = (ms: number) =>
    ms === 0
      ? t('settings.idleOff')
      : ms < 60_000
        ? t('settings.idleSeconds', { count: ms / 1000 })
        : t('settings.idleMinutes', { count: ms / 60_000 });

  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('settings.title')}</h1>
      <ul className="nav-list settings-list">
        <li>
          <div className="setting-row is-stacked">
            <span>
              <span className="setting-name">{t('settings.language')}</span>
              <small>{t('settings.languageHint')}</small>
            </span>
            <Pills
              label={t('settings.language')}
              value={settings.language}
              options={[['auto', t('settings.languageAuto')] as const, ...LANGUAGE_NAMES]}
              onChange={(language) => {
                update({ ...settings, language });
                applyLanguage(language);
              }}
            />
          </div>
        </li>
        <li>
          <label className="setting-row">
            <span>
              <span className="setting-name">{t('settings.unlockAll')}</span>
              <small>{t('settings.unlockAllHint')}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings.unlockAll}
              onChange={(event) => update({ ...settings, unlockAll: event.target.checked })}
            />
          </label>
        </li>
        <li>
          <label className="setting-row">
            <span>
              <span className="setting-name">{t('settings.requireKanji')}</span>
              <small>{t('settings.requireKanjiHint')}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings.requireKanji}
              onChange={(event) => update({ ...settings, requireKanji: event.target.checked })}
            />
          </label>
        </li>
        <li>
          <div className="setting-row is-stacked">
            <span>
              <span className="setting-name">{t('settings.helpIdle')}</span>
              <small>{t('settings.helpIdleHint')}</small>
            </span>
            <Pills
              label={t('settings.helpIdle')}
              value={settings.helpIdleMs}
              options={HELP_IDLE_CHOICES.map((ms) => [ms, idleLabel(ms)] as const)}
              onChange={(helpIdleMs) => update({ ...settings, helpIdleMs })}
            />
          </div>
        </li>
        <li>
          <div className="setting-row is-stacked">
            <span>
              <span className="setting-name">{t('settings.speedUnit')}</span>
              <small>{t('settings.speedUnitHint')}</small>
            </span>
            <Pills
              label={t('settings.speedUnit')}
              value={settings.speedUnit}
              options={SPEED_UNITS.map((unit) => [unit, t(`speed.${unit}`)] as const)}
              onChange={(speedUnit) => update({ ...settings, speedUnit })}
            />
          </div>
        </li>
      </ul>
      {/* 다른 기기에서 받은 설정이 있을 수 있어 동기화가 끝나면 값을 다시 읽는다 */}
      <SyncSettings onSynced={() => setSettings(loadSettings())} />
      <BackupSection />
    </main>
  );
}
