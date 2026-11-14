const ONBOARDED_KEY = 'twiper.onboarded';
const EXAM_RULES_KEY = 'twiper.examRules.seen';
const DEV_MODE_KEY = 'twiper.devMode.v1';

// 브라우저 저장소를 쓸 수 없어도(사생활 보호 모드 등) 앱은 동작해야 하므로 실패는 삼킨다.

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // 저장하지 못해도 진행은 막지 않는다.
  }
}

/** 종합 테스트 주의사항을 본 적이 있는지. 처음 한 번만 저절로 띄운다 */
export function hasSeenExamRules(): boolean {
  try {
    return localStorage.getItem(EXAM_RULES_KEY) === '1';
  } catch {
    return false;
  }
}

export function markExamRulesSeen(): void {
  try {
    localStorage.setItem(EXAM_RULES_KEY, '1');
  } catch {
    // 저장하지 못하면 다음에 또 띄울 뿐이다.
  }
}

/**
 * 개발자 모드: 켜면 단계별 익히기 아래에 개발 도구(/lab)가 보인다. 설정 맨 아래의 버전 글씨를 7번 눌러 켜고 끈다.
 * 숨기기만 할 뿐 막는 장치는 아니다 (화면 코드는 누구나 받을 수 있다). 이 기기에만 남고 동기화하지 않는다
 */
export function isDevMode(): boolean {
  try {
    return localStorage.getItem(DEV_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 바꿔 적었으면 true. 저장소를 쓸 수 없으면 그대로 두고 false */
export function setDevMode(on: boolean): boolean {
  try {
    if (on) localStorage.setItem(DEV_MODE_KEY, '1');
    else localStorage.removeItem(DEV_MODE_KEY);
    return true;
  } catch {
    return false;
  }
}
