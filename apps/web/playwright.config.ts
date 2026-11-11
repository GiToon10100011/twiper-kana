import { defineConfig } from '@playwright/test';

const PORT = 4318;

/**
 * 화면 흐름 테스트 (계획 §15 E2E). 실제 배포와 같은 빌드(서비스 워커 포함)를 띄워 iPhone 크기 Chromium으로 연다.
 * 일본어 입력은 Chromium 개발자 도구의 IME 명령으로 흉내 낸다 (e2e/ime.ts).
 * 파일 이름을 *.e2e.ts로 두어 단위 테스트(vitest)와 섞이지 않게 한다
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    // 화면 문구를 한국어로 확인한다 (기기 언어가 영어면 영어로 열린다)
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  webServer: {
    // CI는 앞 단계에서 이미 빌드했으므로 띄우기만 한다
    command: process.env.CI
      ? `pnpm preview --port ${PORT} --strictPort`
      : `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
