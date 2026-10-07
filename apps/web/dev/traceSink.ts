import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import type { Plugin } from 'vite';

/** 클라이언트(src/features/lab/trace.ts)가 같은 이름의 헤더로 키를 보낸다. */
const TRACE_KEY_HEADER = 'x-twiper-trace-key';

const MAX_TRACE_BYTES = 5 * 1024 * 1024;
const MAX_STORED_TRACES = 30;
const MAX_FAILED_ATTEMPTS = 20;

interface TraceSinkOptions {
  /** trace JSON을 저장할 폴더 (절대 경로) */
  dir: string;
}

function reply(res: ServerResponse, status: number, body: object): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function keyMatches(given: string | string[] | undefined, expected: string): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 브라우저가 보낸 요청이면 Origin이 이 서버 자신이어야 한다. 다른 사이트의 스크립트가 보낸 요청을 막는다. */
function sameOrigin(req: IncomingMessage): boolean {
  const { origin, host } = req.headers;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** 본문을 읽는다. 한도를 넘으면 더 받지 않고 null을 돌려준다. */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_TRACE_BYTES) {
        req.pause();
        req.removeAllListeners('data');
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

async function storedCount(dir: string): Promise<number> {
  try {
    return (await readdir(dir)).filter((name) => name.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

async function saveTrace(dir: string, body: string): Promise<string> {
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
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, file), `${JSON.stringify(parsed, null, 2)}\n`);
  return file;
}

function lanAddresses(): string[] {
  return Object.values(networkInterfaces()).flatMap((nets) =>
    (nets ?? []).filter((net) => net.family === 'IPv4' && !net.internal).map((net) => net.address),
  );
}

/**
 * 개발 서버 전용: 실기기에서 녹화한 trace JSON을 저장소의 픽스처 폴더에 저장한다.
 *
 * 파일을 쓰는 엔드포인트이므로 명시적으로 켰을 때만 등록하고(vite.config.ts), 다음으로 보호한다.
 * - 서버를 띄울 때마다 새로 만드는 키. 터미널에 출력한 주소(#k=…)로 접속한 기기만 안다
 * - 같은 출처 검사, JSON 본문만 허용
 * - 요청당 크기, 저장 파일 수, 키 실패 횟수 제한
 */
export function traceSink({ dir }: TraceSinkOptions): Plugin {
  const key = randomBytes(4).toString('hex');
  let failures = 0;

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') return reply(res, 405, { ok: false });
    if (failures >= MAX_FAILED_ATTEMPTS) return reply(res, 429, { ok: false, reason: 'locked' });
    if (!sameOrigin(req) || !keyMatches(req.headers[TRACE_KEY_HEADER], key)) {
      failures += 1;
      return reply(res, 403, { ok: false, reason: 'key' });
    }
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
      return reply(res, 415, { ok: false, reason: 'content-type' });
    }
    if (Number(req.headers['content-length'] ?? 0) > MAX_TRACE_BYTES) {
      return reply(res, 413, { ok: false, reason: 'too-large' });
    }
    if ((await storedCount(dir)) >= MAX_STORED_TRACES) {
      return reply(res, 507, { ok: false, reason: 'full' });
    }

    const body = await readBody(req);
    if (body === null) {
      // 한도를 넘긴 요청은 응답한 뒤 연결을 끊어 나머지 본문을 받지 않는다.
      res.setHeader('connection', 'close');
      res.once('finish', () => req.destroy());
      return reply(res, 413, { ok: false, reason: 'too-large' });
    }
    try {
      reply(res, 200, { ok: true, file: await saveTrace(dir, body) });
    } catch {
      reply(res, 400, { ok: false, reason: 'json' });
    }
  };

  return {
    name: 'twiper:trace-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__trace', (req, res) => {
        handle(req, res).catch(() => {
          if (!res.headersSent) reply(res, 500, { ok: false });
        });
      });
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        const port =
          typeof address === 'object' && address !== null
            ? address.port
            : server.config.server.port;
        for (const host of ['localhost', ...lanAddresses()]) {
          server.config.logger.info(`  ➜  IME lab: http://${host}:${port}/lab/ime#k=${key}`);
        }
      });
    },
  };
}
