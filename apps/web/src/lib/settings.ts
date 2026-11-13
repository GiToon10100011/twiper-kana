import { HELP_POLICY, nextStampAt, type Stamp, type Stamps } from '@twiper/core';
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
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
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
  } catch {
    return DEFAULT_SETTINGS;
  }
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
