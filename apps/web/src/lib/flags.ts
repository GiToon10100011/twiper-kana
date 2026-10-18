const ONBOARDED_KEY = 'twiper.onboarded';

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
