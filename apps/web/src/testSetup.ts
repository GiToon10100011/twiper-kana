// 테스트는 한국어 화면을 기준으로 쓴다. jsdom·Node의 기기 언어는 en-US라서 i18n을 불러오기 전에 한국어로 맞춘다
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'languages', { configurable: true, value: ['ko-KR'] });
}
