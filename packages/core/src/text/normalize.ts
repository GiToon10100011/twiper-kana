// 보이지 않는 문자를 소스에 직접 두지 않도록 code point 이스케이프로만 쓴다.
const ZERO_WIDTH = /[\u{200B}\u{2060}\u{FEFF}]/gu;
const FULLWIDTH_TILDE = /\u{FF5E}/gu;
const WAVE_DASH = '\u{301C}';

/**
 * 채점 정책과 무관하게 항상 적용하는 정규화.
 * 눈으로 구분할 수 없는 차이만 없애고, 전각/반각·가나 종류·장음 기호는 건드리지 않는다.
 */
export function normalizeBase(text: string): string {
  return text.normalize('NFC').replace(ZERO_WIDTH, '').replace(FULLWIDTH_TILDE, WAVE_DASH);
}

/** 최종 비교용: 기본 정규화 후 앞뒤 공백·줄바꿈을 제거한다. */
export function normalizeForCompare(text: string): string {
  return normalizeBase(text).trim();
}
