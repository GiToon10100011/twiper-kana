import type { TrainingRepo } from '@twiper/core';
import { applyLanguage } from '../i18n';
import { deviceId } from './device';
import { clearSettingStamps, loadSettings, stampAllSettings } from './settings';
import { resetSyncCursor, syncDevice } from './sync';
import { cryptoCodec, newSyncCode, normalizeSyncCode, syncKeys } from './syncCrypto';
import { httpSyncServer, SyncHttpError } from './syncHttp';

const LINK_KEY = 'twiper.sync.link.v1';

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
  resetSyncCursor();
  clearSettingStamps();
  saveSyncLink(link);
  return link;
}

/** 「이 기기에서 끄기」: 이 기기의 기록과 설정은 그대로 두고 공간과의 연결만 끊는다 */
export function turnOffSync(): void {
  saveSyncLink(null);
  resetSyncCursor();
}

/** 한 번 주고받은 결과. 다른 기기에서 서버의 기록을 지웠으면(410) 이 기기의 동기화도 꺼지고 gone */
export type SyncRun = { readonly link: SyncLink } | { readonly gone: true };

let running: Promise<SyncRun | null> | null = null;

/**
 * 지금 한 번 주고받는다 (§4.5). 꺼져 있으면 null. 이미 주고받는 중이면 그 결과를 함께 기다린다.
 * 받은 설정에 언어가 있으면 화면 언어를 바로 바꾼다. fetchFn·now는 테스트용
 */
export function runSync(
  repo: TrainingRepo,
  options: { readonly fetchFn?: Fetch; readonly now?: () => number } = {},
): Promise<SyncRun | null> {
  running ??= (async () => {
    const link = loadSyncLink();
    if (!link) return null;
    const keys = await syncKeys(link.code);
    const server = httpSyncServer(keys, deviceId(), options.fetchFn);
    let next: SyncLink;
    try {
      const outcome = await syncDevice(repo, server, cryptoCodec(keys.encKey), (changed) => {
        if (changed.includes('language')) applyLanguage(loadSettings().language);
      });
      next =
        outcome.status === 'done'
          ? { ...link, syncedAt: (options.now ?? Date.now)(), problem: null }
          : { ...link, problem: 'update' };
    } catch (error) {
      if (error instanceof SyncHttpError && error.status === 410) {
        turnOffSync();
        return { gone: true } as const;
      }
      next = { ...link, problem: 'failed' };
    }
    // 그사이 이 기기에서 끄거나 다른 코드로 바꿨으면 결과를 남기지 않는다
    if (loadSyncLink()?.code === link.code) saveSyncLink(next);
    return { link: next };
  })().finally(() => {
    running = null;
  });
  return running;
}

/**
 * 「서버의 기록 지우기」: 공간의 묶음을 모두 지우고 이 코드를 다시 쓸 수 없게 한 뒤, 이 기기의 동기화를 끈다.
 * 각 기기의 기록은 남는다. 지우지 못하면 던진다
 */
export async function removeSyncSpace(options: { readonly fetchFn?: Fetch } = {}): Promise<void> {
  const link = loadSyncLink();
  if (!link) return;
  const keys = await syncKeys(link.code);
  await httpSyncServer(keys, deviceId(), options.fetchFn).remove();
  turnOffSync();
}
