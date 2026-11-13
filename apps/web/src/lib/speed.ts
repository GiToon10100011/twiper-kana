import type { SpeedUnit } from './settings';

/** 속도를 낼 수 있는 기록: 가나/분과, 같은 줄·같은 시간의 WPM(헤본식 로마자 5글자 = 1단어) */
export interface Speeds {
  readonly kpm: number | null;
  /** 로마자 속도를 함께 남기기 전의 기록에는 없다 */
  readonly wpm?: number | null;
}

/**
 * 설정에서 고른 단위의 속도 (가나/분 · CPM · WPM). CPM은 1분에 친 로마자 글자 수라 WPM의 5배다.
 * 로마자 속도를 모르는 예전 기록은 CPM·WPM으로 바꿀 수 없어 null
 */
export function speedIn(unit: SpeedUnit, speeds: Speeds): number | null {
  if (unit === 'kpm') return speeds.kpm;
  const wpm = speeds.wpm ?? null;
  return wpm === null ? null : unit === 'cpm' ? wpm * 5 : wpm;
}
