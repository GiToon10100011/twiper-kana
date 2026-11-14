import { HELP_POLICY, isLaterStamp, nextStampAt, type Stamp, type Stamps } from '@twiper/core';
import { deviceId } from './device';
import { LOCALES, type LanguageChoice } from '../i18n/locale';

const SETTINGS_KEY = 'twiper.settings.v1';
const STAMPS_KEY = 'twiper.settings.stamps.v1';

/** 도움말을 기다리는 시간으로 고를 수 있는 값 (ms). 0은 기다려도 띄우지 않는다 */
export const HELP_IDLE_CHOICES: readonly number[] = [30_000, 60_000, 180_000, 300_000, 0];

/**
 * 속도 단위: 가나/분(기본) · CPM(1분에 친 헤본식 로마자 글자 수) · WPM(로마자 5글자 = 1단어).
 * 결과·종합 테스트·홈 최고 속도·추세에 함께 쓴다
 */
export const SPEED_UNITS = ['kpm', 'cpm', 'wpm'] as const;
export type SpeedUnit = (typeof SPEED_UNITS)[number];

export interface Settings {
  /** 순서와 관계없이 모든 레벨을 연다 */
  readonly unlockAll: boolean;
  /** 다음 글자에서 이만큼(ms) 멈추면 치는 법을 띄운다. 0이면 띄우지 않는다 */
  readonly helpIdleMs: number;
  /**
   * 한자는 그 한자로 바꿔 確定해야 맞다 (기본). 끄면 읽기(가나)대로만 쳐도 맞다.
   * 가타카나는 이 설정과 관계없이 바꿔야 맞다 (2026-10-26 사용자 제안)
   */
  readonly requireKanji: boolean;
  /** 화면 언어. auto는 기기 언어를 따른다 */
  readonly language: LanguageChoice;
  /** 화면에 보일 속도 단위 */
  readonly speedUnit: SpeedUnit;
}

export const DEFAULT_SETTINGS: Settings = {
  unlockAll: false,
  helpIdleMs: HELP_POLICY.idleMs,
  requireKanji: true,
  language: 'auto',
  speedUnit: 'kpm',
};

const isSpeedUnit = (value: unknown): value is SpeedUnit =>
  SPEED_UNITS.some((unit) => unit === value);

const isLanguageChoice = (value: unknown): value is LanguageChoice =>
  value === 'auto' || LOCALES.some((locale) => locale === value);

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? parseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** 저장해 둔 값을 읽는다. 고를 수 없는 값은 기본값으로 본다 */
function parseSettings(parsed: unknown): Settings {
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;
  const { unlockAll, helpIdleMs, requireKanji, language, speedUnit } = parsed as Record<
    string,
    unknown
  >;
  return {
    unlockAll: unlockAll === true,
    helpIdleMs:
      typeof helpIdleMs === 'number' && HELP_IDLE_CHOICES.includes(helpIdleMs)
        ? helpIdleMs
        : DEFAULT_SETTINGS.helpIdleMs,
    // 예전에 저장한 설정에는 없으므로 껐을 때만 끈다
    requireKanji: requireKanji !== false,
    language: isLanguageChoice(language) ? language : DEFAULT_SETTINGS.language,
    speedUnit: isSpeedUnit(speedUnit) ? speedUnit : DEFAULT_SETTINGS.speedUnit,
  };
}

/** 바꾼 항목에는 바꾼 때를 찍는다 (동기화 설계 §4.4). now는 테스트용 */
export function saveSettings(settings: Settings, now = Date.now()): void {
  const before = loadSettings();
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 저장하지 못하면 이번 실행에서만 바뀐 값이 적용된다.
    return;
  }
  stampChanges(before, settings, now);
}

export type SettingKey = keyof Settings;

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

const isStamp = (value: unknown): value is Stamp =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).at === 'number' &&
  typeof (value as Record<string, unknown>).deviceId === 'string';

/**
 * 설정 항목마다 마지막에 바꾼 때와 기기. 기기끼리 설정을 맞출 때 나중에 바꾼 쪽이 이긴다 (동기화 설계 §4.4).
 * 동기화가 생기기 전에 바꾼 항목에는 없다
 */
export function loadSettingStamps(): Stamps<SettingKey> {
  try {
    const raw = localStorage.getItem(STAMPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      SETTING_KEYS.flatMap((key) => {
        const stamp = (parsed as Record<string, unknown>)[key];
        return isStamp(stamp) ? [[key, stamp]] : [];
      }),
    );
  } catch {
    return {};
  }
}

function stampChanges(before: Settings, after: Settings, now: number): void {
  const changed = SETTING_KEYS.filter((key) => before[key] !== after[key]);
  if (changed.length === 0) return;
  const stamps = loadSettingStamps();
  const stamp: Stamp = { at: nextStampAt(now, stamps), deviceId: deviceId() };
  try {
    localStorage.setItem(
      STAMPS_KEY,
      JSON.stringify({ ...stamps, ...Object.fromEntries(changed.map((key) => [key, stamp])) }),
    );
  } catch {
    // 찍지 못한 항목은 다른 기기와 맞출 때 가장 약한 값으로 친다.
  }
}

/** 동기화 묶음에 실을 설정: 바꾼 때가 있는 항목만 값과 함께 (동기화 설계 §4.4) */
export function stampedSettings(): Record<string, { value: unknown; stamp: Stamp }> {
  const settings = loadSettings();
  const stamps = loadSettingStamps();
  return Object.fromEntries(
    SETTING_KEYS.flatMap((key) => {
      const stamp = stamps[key];
      return stamp ? [[key, { value: settings[key], stamp }]] : [];
    }),
  );
}

/**
 * 이 기기에서 가장 늦게 바꾼 때 (ms), 없으면 0. 다른 기기에서 받은 값은 이미 공간에 있으므로 세지 않는다
 * (받은 때로 세면, 이 기기에서 다른 항목을 바꾼 것이 올라가지 않을 수 있다)
 */
export const latestOwnSettingStamp = (device: string): number =>
  Math.max(
    0,
    ...Object.values(loadSettingStamps()).map((stamp) =>
      stamp?.deviceId === device ? stamp.at : 0,
    ),
  );

/**
 * 다른 기기의 설정을 합친다: 항목마다 나중에 바꾼 쪽이 이긴다 (동기화 설계 §4.4).
 * 이 앱이 고를 수 있는 값만 받는다. 값이 바뀐 항목을 돌려준다 (언어가 바뀌면 화면에 바로 반영한다).
 * 저장하지 못하면 던진다: 동기화가 그 묶음을 받은 것으로 치지 않고 다음에 다시 받게
 */
export function mergeSyncedSettings(incoming: unknown): SettingKey[] {
  if (typeof incoming !== 'object' || incoming === null) return [];
  const stamps: Partial<Record<SettingKey, Stamp>> = { ...loadSettingStamps() };
  let next: Settings = loadSettings();
  let stampsChanged = false;
  const changed: SettingKey[] = [];
  for (const key of SETTING_KEYS) {
    const theirs: unknown = (incoming as Record<string, unknown>)[key];
    if (typeof theirs !== 'object' || theirs === null) continue;
    const { value, stamp } = theirs as { value: unknown; stamp: unknown };
    const mine = stamps[key];
    if (!isStamp(stamp) || (mine && !isLaterStamp(stamp, mine))) continue;
    const candidate = parseSettings({ ...next, [key]: value });
    if (candidate[key] !== value) continue;
    stamps[key] = stamp;
    stampsChanged = true;
    if (next[key] !== value) {
      next = candidate;
      changed.push(key);
    }
  }
  // 받은 값에는 새로 찍지 않는다 (바꾼 때는 받은 그대로)
  if (changed.length > 0) localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  if (stampsChanged) localStorage.setItem(STAMPS_KEY, JSON.stringify(stamps));
  return changed;
}
