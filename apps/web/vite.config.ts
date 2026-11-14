/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { traceSink } from './dev/traceSink';

const TRACE_DIR = fileURLToPath(
  new URL('../../packages/core/test/fixtures/traces/incoming/', import.meta.url),
);

// 실기기 trace 수집은 파일을 쓰는 기능이라 명시적으로 켰을 때만 등록한다 (pnpm dev:lan).
const traceSinkEnabled = process.env.TWIPER_TRACE_SINK === '1';

const BG = '#fcfcf9';

export default defineConfig({
  plugins: [
    react(),
    // 설치형 앱 + 오프라인 (계획 §14). 서비스 워커는 빌드에서만 만들고 개발 서버에는 켜지 않는다.
    // 새 버전은 사용자가 고를 때만 적용한다 (훈련 중 강제 새로고침 금지).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'twiper',
        short_name: 'twiper',
        description:
          'iPhone 일본어 가나 키보드(12키)로 플릭 입력을 연습하는 무료 웹앱. 가입 없이, 오프라인에서도.',
        categories: ['education'],
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: BG,
        theme_color: BG,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        // 링크 공유 미리보기 이미지는 앱에서 쓰지 않으므로 미리 받지 않는다
        globIgnores: ['**/og-image.png'],
        navigateFallback: '/index.html',
        // 개발용 trace 수집 엔드포인트와 동기화 API는 가로채지 않는다
        navigateFallbackDenylist: [/^\/__trace/, /^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
    ...(traceSinkEnabled ? [traceSink({ dir: TRACE_DIR })] : []),
  ],
  test: {
    // 화면 문구를 한국어로 확인하므로 기기 언어를 한국어로 둔다
    setupFiles: ['./src/testSetup.ts'],
  },
});
