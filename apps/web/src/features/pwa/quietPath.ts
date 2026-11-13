/**
 * 새 버전 알림을 띄우지 않는 화면: 단계별 연습·종합 테스트·약점 연습·오늘 복습·튜토리얼.
 * 치는 도중에 알림이 끼어들거나 새로고침으로 입력 흐름이 끊기지 않게 한다 (계획 §14)
 */
export const isQuietPath = (path: string): boolean =>
  path.startsWith('/train/') ||
  path.startsWith('/test/') ||
  path === '/weak' ||
  path === '/review' ||
  path === '/tutorial';
