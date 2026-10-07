import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const TRACE_DIR = fileURLToPath(
  new URL('../../packages/core/test/fixtures/traces/incoming/', import.meta.url),
);
const MAX_TRACE_BYTES = 5 * 1024 * 1024;

async function saveTrace(body: string): Promise<string> {
  const parsed: unknown = JSON.parse(body);
  const label =
    typeof parsed === 'object' &&
    parsed !== null &&
    'label' in parsed &&
    typeof parsed.label === 'string'
      ? parsed.label.replace(/[^a-z0-9-]/gi, '').slice(0, 40)
      : '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `${stamp}${label ? `-${label}` : ''}.json`;
  await mkdir(TRACE_DIR, { recursive: true });
  await writeFile(path.join(TRACE_DIR, file), `${JSON.stringify(parsed, null, 2)}\n`);
  return file;
}

/** 개발 서버 전용: 실기기에서 녹화한 trace JSON을 저장소의 픽스처 폴더에 저장한다. */
function traceSink(): Plugin {
  return {
    name: 'twiper:trace-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__trace', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let rejected = false;
        req.on('data', (chunk: Buffer) => {
          if (rejected) return;
          size += chunk.length;
          if (size > MAX_TRACE_BYTES) {
            rejected = true;
            res.statusCode = 413;
            res.end();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => {
          if (rejected) return;
          saveTrace(Buffer.concat(chunks).toString('utf8')).then(
            (file) => {
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ ok: true, file }));
            },
            () => {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false }));
            },
          );
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), traceSink()],
  server: { host: true },
});
