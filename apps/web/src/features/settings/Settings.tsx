import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  HELP_IDLE_CHOICES,
  loadSettings,
  saveSettings,
  type Settings as SettingsValue,
} from '../../lib/settings';
import { BackIcon } from '../../ui/icons';
import { Pills } from '../../ui/Pills';

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
      </ul>
    </main>
  );
}
