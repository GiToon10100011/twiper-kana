import type { TrainingRepo } from '@twiper/core';
import { applyLanguage } from '../i18n';
import { deviceId } from './device';
import { clearSettingStamps, loadSettings, stampAllSettings } from './settings';
import { resetSyncCursor, snapshotBatches, syncCursor, syncDevice } from './sync';
import {
  cryptoCodec,
  newSyncCode,
  normalizeSyncCode,
  syncKeys,
  type SyncPayload,
} from './syncCrypto';
import { httpSyncServer, SyncHttpError } from './syncHttp';

const LINK_KEY = 'twiper.sync.link.v1';
/** 진행 중인 압축 임대 { code, id }. 끊기면 다음 동기화 처음에 취소한다 */
const COMPACTION_KEY = 'twiper.sync.compaction.v1';

/** 공간이 이만큼 쌓이면 압축한다 (공간 한도의 절반, 동기화 설계 §4.6) */
export const COMPACT_AT_BYTES = 10 * 1024 * 1024;

/** 1분 한도에 걸린 스냅샷 조각을 다시 올리기 전에 기다리는 시간 (한도 창 1분 + 여유) */
const RATE_RETRY_MS = 61_000;

/** 1분 한도에 걸린 조각을 다시 올리는 횟수 */
const RATE_RETRIES = 3;

/**
 * 압축할 때인가: 문턱과, 마지막 압축 직후 크기의 2배 가운데 큰 값을 넘었을 때.
 * 스냅샷만으로 문턱을 넘는 공간을 동기화할 때마다 다시 압축하지 않게 한다
 */
export const shouldCompact = (
  size: { readonly bytes: number; readonly compactedBytes: number } | null,
  threshold = COMPACT_AT_BYTES,
): boolean => size !== null && size.bytes >= Math.max(threshold, size.compactedBytes * 2);

/** 지난 동기화가 남긴 문제: 연결 실패 · 더 높은 버전의 묶음이 있어 업데이트가 필요함 */
export type SyncLinkProblem = 'failed' | 'update';

/** 이 기기가 쓰는 동기화 공간 (동기화 설계 §4.1) */
export interface SyncLink {
  /** 동기화 코드 (26자). 키는 그때그때 이 코드에서 만든다 */
  readonly code: string;
  /** 마지막으로 끝까지 주고받은 때 (ms) */
  readonly syncedAt: number | null;
  readonly problem: SyncLinkProblem | null;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * 연결의 세대. 켜기·코드 넣기·끄기마다 올라간다. 도중에 연결이 바뀌면 늦게 끝난 옛 작업(동기화·지우기)이
 * 새 연결을 지우거나 그 커서를 덮어쓰지 않도록, 작업은 시작한 세대가 그대로일 때만 결과를 남긴다
 */
let generation = 0;

export function loadSyncLink(): SyncLink | null {
  try {
    const raw = localStorage.getItem(LINK_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { code, syncedAt, problem } = parsed as Record<string, unknown>;
    const valid = typeof code === 'string' ? normalizeSyncCode(code) : null;
    if (!valid) return null;
    return {
      code: valid,
      syncedAt: typeof syncedAt === 'number' ? syncedAt : null,
      problem: problem === 'failed' || problem === 'update' ? problem : null,
    };
  } catch {
    return null;
  }
}

function saveSyncLink(link: SyncLink | null): void {
  try {
    if (link) localStorage.setItem(LINK_KEY, JSON.stringify(link));
    else localStorage.removeItem(LINK_KEY);
  } catch {
    // 저장하지 못하면 이번 실행 동안만 켜진다.
  }
}

/**
 * 「이 기기에서 켜기」: 새 코드로 새 공간을 쓴다. 이 기기의 설정 전부가 공간의 첫 설정이 된다 (§4.4).
 * 기록은 다음 동기화에서 처음부터 모두 올린다
 */
export function enableSync(now = Date.now()): SyncLink {
  const link: SyncLink = { code: newSyncCode(), syncedAt: null, problem: null };
  generation += 1;
  resetSyncCursor();
  stampAllSettings(now);
  saveSyncLink(link);
  return link;
}

/**
 * 「다른 기기의 코드 넣기」: 코드가 맞으면 그 공간을 쓰고, 설정은 공간의 것을 따른다 (§4.4).
 * 코드가 아니면 null
 */
export function joinSync(input: string): SyncLink | null {
  const code = normalizeSyncCode(input);
  if (!code) return null;
  const link: SyncLink = { code, syncedAt: null, problem: null };
  generation += 1;
  resetSyncCursor();
  clearSettingStamps();
  saveSyncLink(link);
  return link;
}

/** 「이 기기에서 끄기」: 이 기기의 기록과 설정은 그대로 두고 공간과의 연결만 끊는다 */
export function turnOffSync(): void {
  generation += 1;
  saveSyncLink(null);
  resetSyncCursor();
}

function loadPendingCompaction(): { code: string; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COMPACTION_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { code, id } = parsed as Record<string, unknown>;
    return typeof code === 'string' && typeof id === 'string' ? { code, id } : null;
  } catch {
    return null;
  }
}

function savePendingCompaction(pending: { code: string; id: string } | null): void {
  try {
    if (pending) localStorage.setItem(COMPACTION_KEY, JSON.stringify(pending));
    else localStorage.removeItem(COMPACTION_KEY);
  } catch {
    // 적지 못하면 끊긴 임대는 15분 뒤 버려진 것으로 보고 다음 압축이 넘겨받는다.
  }
}

type Server = ReturnType<typeof httpSyncServer>;

/** 지난번에 끊긴 압축이 있으면 그 임대의 조각만 지운다. 다른 코드의 임대는 15분 뒤 저절로 풀린다 */
async function abortPendingCompaction(code: string, server: Server): Promise<void> {
  const pending = loadPendingCompaction();
  if (!pending) return;
  if (pending.code === code) await server.abortCompaction(pending.id).catch(() => undefined);
  savePendingCompaction(null);
}

/**
 * 압축 (§4.6): 임대를 받고, 이 기기의 전체 상태와 기록을 스냅샷 조각으로 올린 뒤 끝낸다. 서버는 끝낼 때
 * 이 기기가 받은 데(upTo)까지의 묶음을 지운다. 스냅샷에는 그것이 모두 들어 있다
 */
async function compact(
  repo: TrainingRepo,
  server: Server,
  encode: (batch: Awaited<ReturnType<typeof snapshotBatches>>[number]) => Promise<SyncPayload>,
  code: string,
  isCurrent: () => boolean,
  wait: (ms: number) => Promise<void>,
): Promise<void> {
  const id = await server.startCompaction(syncCursor().lastSeq);
  savePendingCompaction({ code, id });
  for (const batch of await snapshotBatches(repo)) {
    // 그사이 연결이 바뀌었으면 그만둔다 (적어 둔 임대는 다음에 취소한다)
    if (!isCurrent()) return;
    const payload = await encode(batch);
    // 조각이 많으면 공간의 1분 한도에 걸린다: 한도가 풀릴 때까지 기다렸다 다시 올린다
    for (let attempt = 0; ; attempt += 1) {
      try {
        await server.pushSnapshot(payload, id);
        break;
      } catch (error) {
        const limited = error instanceof SyncHttpError && error.status === 429;
        if (!limited || attempt >= RATE_RETRIES) throw error;
        await wait(RATE_RETRY_MS);
        if (!isCurrent()) return;
      }
    }
  }
  if (!isCurrent()) return;
  await server.finishCompaction(id);
  savePendingCompaction(null);
}

/** 뒤에서 도는 압축. 한 번에 하나만 돌린다 */
let compacting: Promise<void> | null = null;

/** 뒤에서 도는 압축이 끝날 때까지 기다린다 (테스트용) */
export const compactionSettled = (): Promise<void> => compacting ?? Promise.resolve();

/** 한 번 주고받은 결과. 다른 기기에서 서버의 기록을 지웠으면(410) 이 기기의 동기화도 꺼지고 gone */
export type SyncRun = { readonly link: SyncLink } | { readonly gone: true };

/** 지금 도는 동기화와 그 세대. 같은 세대일 때만 함께 기다린다 */
let running: { readonly generation: number; readonly result: Promise<SyncRun | null> } | null =
  null;

/**
 * 지금 한 번 주고받는다 (§4.5). 꺼져 있으면 null. 이미 주고받는 중이면 그 결과를 함께 기다린다.
 * 받은 설정에 언어가 있으면 화면 언어를 바로 바꾼다. fetchFn·now는 테스트용
 */
export function runSync(
  repo: TrainingRepo,
  options: {
    readonly fetchFn?: Fetch;
    readonly now?: () => number;
    /** 이만큼 쌓이면 압축한다 (테스트용) */
    readonly compactAt?: number;
    /** 한도에 걸린 조각을 다시 올리기 전에 기다린다 (테스트용) */
    readonly wait?: (ms: number) => Promise<void>;
  } = {},
): Promise<SyncRun | null> {
  if (running && running.generation === generation) return running.result;
  const started = generation;
  const isCurrent = () => generation === started;
  const result = (async (): Promise<SyncRun | null> => {
    const link = loadSyncLink();
    if (!link) return null;
    const keys = await syncKeys(link.code);
    const server = httpSyncServer(keys, deviceId(), options.fetchFn);
    const codec = cryptoCodec(keys.encKey);
    let next: SyncLink;
    try {
      await abortPendingCompaction(link.code, server);
      const outcome = await syncDevice(
        repo,
        server,
        codec,
        (changed) => {
          if (changed.includes('language')) applyLanguage(loadSettings().language);
        },
        isCurrent,
      );
      if (
        outcome.status === 'done' &&
        isCurrent() &&
        compacting === null &&
        shouldCompact(server.spaceSize(), options.compactAt)
      ) {
        // 압축은 동기화 결과를 남긴 뒤 뒤에서 돌린다. 실패해도 동기화 결과와 상관없다 (다음에 다시 한다)
        const wait =
          options.wait ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
        compacting = compact(
          repo,
          server,
          (batch) => codec.encode(batch),
          link.code,
          isCurrent,
          wait,
        )
          .catch(() => undefined)
          .finally(() => {
            compacting = null;
          });
      }
      next =
        outcome.status === 'done'
          ? { ...link, syncedAt: (options.now ?? Date.now)(), problem: null }
          : { ...link, problem: 'update' };
    } catch (error) {
      // 그사이 끄거나 다른 코드로 바꿨으면 이 결과는 버린다
      if (!isCurrent()) return null;
      if (error instanceof SyncHttpError && error.status === 410) {
        turnOffSync();
        return { gone: true } as const;
      }
      next = { ...link, problem: 'failed' };
    }
    if (!isCurrent()) return null;
    saveSyncLink(next);
    return { link: next };
  })();
  running = { generation: started, result };
  void result.finally(() => {
    if (running?.result === result) running = null;
  });
  return result;
}

/**
 * 「서버의 기록 지우기」: 공간의 묶음을 모두 지우고 이 코드를 다시 쓸 수 없게 한 뒤, 이 기기의 동기화를 끈다.
 * 각 기기의 기록은 남는다. 지우지 못하면 던진다. 그사이 연결이 바뀌었으면 새 연결은 그대로 두고 false
 */
export async function removeSyncSpace(
  options: { readonly fetchFn?: Fetch } = {},
): Promise<boolean> {
  const link = loadSyncLink();
  if (!link) return false;
  const started = generation;
  const keys = await syncKeys(link.code);
  await httpSyncServer(keys, deviceId(), options.fetchFn).remove();
  if (generation !== started) return false;
  turnOffSync();
  return true;
}
