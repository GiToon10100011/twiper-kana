import {
  buildBatches,
  syncOnce,
  type SyncCodec,
  type SyncCursor,
  type SyncDevice,
  type SyncOutcome,
  type SyncServer,
  type TrainingRepo,
} from '@twiper/core';
import { mergeRecordsOf } from './backup';
import { deviceId } from './device';
import { loadExamRecords, parseExamRecords } from './examRecords';
import { ensureLegacyPlays, loadLegacyPlays, parseLegacyPlays } from './plays';
import { loadProgress, parseProgress } from './progress';
import {
  latestOwnSettingStamp,
  mergeSyncedSettings,
  stampedSettings,
  type SettingKey,
} from './settings';

const SYNC_KEY = 'twiper.sync.v1';

/** 이 기기의 동기화 상태 */
interface SyncStored extends SyncCursor {
  /** 마지막으로 올린, 이 기기에서 바꾼 설정의 가장 늦은 때. 이보다 늦게 바꿨으면 다시 올린다 */
  readonly settingsAt: number;
  /**
   * 공간과 같다고 아는 진도·종합 테스트 기록·옛 횟수의 요약값. 지금 요약값이 다르면 (백업을 가져와
   * 진도만 바뀐 경우처럼) 새 기록이 없어도 올린다
   */
  readonly summary: string;
}

const EMPTY: SyncStored = { lastSeq: 0, uploaded: false, settingsAt: 0, summary: '' };

/** 진도·종합 테스트 기록·옛 횟수의 요약값 (FNV-1a) */
function summaryHash(
  state: readonly unknown[] = [loadProgress(), loadExamRecords(), loadLegacyPlays()],
): string {
  const text = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

function loadSync(): SyncStored {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const { lastSeq, uploaded, settingsAt, summary } = parsed as Record<string, unknown>;
    return {
      lastSeq: typeof lastSeq === 'number' ? lastSeq : 0,
      uploaded: uploaded === true,
      settingsAt: typeof settingsAt === 'number' ? settingsAt : 0,
      summary: typeof summary === 'string' ? summary : '',
    };
  } catch {
    return EMPTY;
  }
}

/** 커서를 비운다 (동기화를 켜거나 끌 때: 새 공간은 처음부터 받고, 처음 올리기를 다시 한다) */
export function resetSyncCursor(): void {
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {
    // 비우지 못하면 다음 동기화가 예전 번호부터 받는다. 새 공간이라면 받을 것이 없을 뿐이다.
  }
}

function saveSync(stored: SyncStored): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(stored));
  } catch {
    // 저장하지 못하면 다음에 같은 묶음을 다시 받는다. 합치기가 중복을 없앤다.
  }
}

/**
 * 이 기기(localStorage·IndexedDB)를 동기화 엔진에 잇는다 (동기화 설계 §4.5).
 * 받은 묶음은 백업 가져오기와 같은 규칙으로 합치되 outbox에는 넣지 않는다.
 * onSettings: 받은 설정으로 값이 바뀐 항목 (언어가 바뀌면 화면에 바로 반영한다).
 * isCurrent: 아직 이 연결로 주고받는 중인지. 그사이 끄거나 다른 코드로 바꿨으면 저장하기 전에 멈춘다
 * (옛 작업이 새 연결의 커서·요약값을 덮어쓰지 않게)
 */
export function createSyncDevice(
  repo: TrainingRepo,
  onSettings?: (changed: readonly SettingKey[]) => void,
  isCurrent: () => boolean = () => true,
): SyncDevice {
  const check = () => {
    if (!isCurrent()) throw new SyncSuperseded();
  };
  return {
    loadCursor() {
      const { lastSeq, uploaded } = loadSync();
      return Promise.resolve({ lastSeq, uploaded });
    },
    saveCursor(cursor) {
      check();
      saveSync({ ...loadSync(), lastSeq: cursor.lastSeq, uploaded: cursor.uploaded });
      return Promise.resolve();
    },
    async merge(batch) {
      check();
      // 합치기 전에 공간과 같았다면, 합친 뒤의 상태도 공간에서 온 것이라 다시 올릴 필요가 없다
      const clean = summaryHash() === loadSync().summary;
      const merged = await mergeRecordsOf(
        {
          progress: parseProgress(batch.progress),
          exams: parseExamRecords(batch.exams),
          legacyPlays: parseLegacyPlays(batch.legacyPlays),
          attempts: batch.attempts,
          sessions: batch.sessions,
        },
        repo,
        false,
      );
      // 기기에 남기지 못했으면(메모리 저장소로 바뀐 경우 등) 받은 것으로 치지 않는다: 다음에 다시 받는다
      if (!merged.persisted) throw new Error('받은 기록을 기기에 저장하지 못했다');
      check();
      const changed = mergeSyncedSettings(batch.settings);
      if (clean) saveSync({ ...loadSync(), summary: summaryHash() });
      if (changed.length > 0) onSettings?.(changed);
    },
    async collect(full) {
      const legacyPlays = await ensureLegacyPlays(repo);
      // 묶음에 싣는 상태와, 올린 것으로 기록할 요약값·설정을 바꾼 때를 한 번에 읽는다
      // (기다리는 사이 값이 바뀌어도 둘이 어긋나 바뀐 것을 올리지 않는 일이 없게)
      const progress = loadProgress();
      const exams = loadExamRecords();
      const settings = stampedSettings();
      const summary = summaryHash([progress, exams, legacyPlays]);
      const settingsAt = latestOwnSettingStamp(deviceId());
      const pending = await repo.pendingRecords();
      const stored = loadSync();
      const records = full ? await repo.dumpRecords() : pending;
      const nothing = records.attempts.length === 0 && records.sessions.length === 0;
      if (!full && nothing && settingsAt <= stored.settingsAt && summary === stored.summary) {
        return { batches: [], done: () => Promise.resolve() };
      }
      const state = { progress, exams, legacyPlays, settings };
      return {
        batches: buildBatches(deviceId(), state, records),
        async done() {
          check();
          await repo.markPushed(pending.entries);
          saveSync({ ...loadSync(), settingsAt, summary });
        },
      };
    },
  };
}

/** 주고받는 사이 이 기기에서 동기화를 끄거나 다른 코드로 바꿨다 */
export class SyncSuperseded extends Error {
  constructor() {
    super('동기화 연결이 바뀌었다');
    this.name = 'SyncSuperseded';
  }
}

/** JSON 그대로 주고받는 codec. 메모리 서버와 시험용이며, 실제 서버에는 압축 + 암호화 codec을 쓴다 (S3) */
export const jsonCodec: SyncCodec<string> = {
  encode: (batch) => Promise.resolve(JSON.stringify(batch)),
  decode: (payload) => Promise.resolve(JSON.parse(payload) as unknown),
};

/** 이 기기를 서버와 한 번 주고받는다 */
export function syncDevice<P>(
  repo: TrainingRepo,
  server: SyncServer<P>,
  codec: SyncCodec<P>,
  onSettings?: (changed: readonly SettingKey[]) => void,
  isCurrent?: () => boolean,
): Promise<SyncOutcome> {
  return syncOnce(createSyncDevice(repo, onSettings, isCurrent), server, codec);
}
