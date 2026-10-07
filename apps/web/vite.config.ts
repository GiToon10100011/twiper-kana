import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { traceSink } from './dev/traceSink';

const TRACE_DIR = fileURLToPath(
  new URL('../../packages/core/test/fixtures/traces/incoming/', import.meta.url),
);

// 실기기 trace 수집은 파일을 쓰는 기능이라 명시적으로 켰을 때만 등록한다 (pnpm dev:lan).
const traceSinkEnabled = process.env.TWIPER_TRACE_SINK === '1';

export default defineConfig({
  plugins: [react(), ...(traceSinkEnabled ? [traceSink({ dir: TRACE_DIR })] : [])],
});
