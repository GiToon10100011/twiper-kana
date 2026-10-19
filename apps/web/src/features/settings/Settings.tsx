import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { loadSettings, saveSettings, type Settings as SettingsValue } from '../../lib/settings';
import { BackIcon } from '../../ui/icons';

export function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(loadSettings);

  const update = (next: SettingsValue) => {
    setSettings(next);
    saveSettings(next);
  };

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
      </ul>
    </main>
  );
}
