const SETTINGS_KEY = 'twiper.settings.v1';

export interface Settings {
  /** 순서와 관계없이 모든 레벨을 연다 */
  readonly unlockAll: boolean;
}

const DEFAULTS: Settings = { unlockAll: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;
    return { unlockAll: (parsed as Record<string, unknown>).unlockAll === true };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 저장하지 못하면 이번 실행에서만 바뀐 값이 적용된다.
  }
}
