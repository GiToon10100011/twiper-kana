const ONBOARDED_KEY = 'twiper.onboarded';
const EXAM_RULES_KEY = 'twiper.examRules.seen';

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
