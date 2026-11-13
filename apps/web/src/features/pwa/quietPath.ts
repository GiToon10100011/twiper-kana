/**
 * 새 버전 알림을 띄우지 않는 화면: 단계별 연습·종합 테스트·약점 연습·오늘 복습·튜토리얼.
 * 치는 도중에 알림이 끼어들거나 새로고침으로 입력 흐름이 끊기지 않게 한다 (계획 §14).
 * 라우터처럼 대소문자와 끝 슬래시를 가리지 않는다 (/weak/, /Review)
 */
export function isQuietPath(path: string): boolean {
  const route = path.toLowerCase().replace(/\/+$/u, '');
  return (
    route.startsWith('/train/') ||
    route.startsWith('/test/') ||
    route === '/weak' ||
    route === '/review' ||
    route === '/tutorial'
  );
}
