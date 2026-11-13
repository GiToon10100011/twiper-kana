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
import { ensureLegacyPlays, parseLegacyPlays } from './plays';
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
}

const EMPTY: SyncStored = { lastSeq: 0, uploaded: false, settingsAt: 0 };

function loadSync(): SyncStored {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const { lastSeq, uploaded, settingsAt } = parsed as Record<string, unknown>;
    return {
      lastSeq: typeof lastSeq === 'number' ? lastSeq : 0,
      uploaded: uploaded === true,
      settingsAt: typeof settingsAt === 'number' ? settingsAt : 0,
    };
  } catch {
    return EMPTY;
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
 * onSettings: 받은 설정으로 값이 바뀐 항목 (언어가 바뀌면 화면에 바로 반영한다)
 */
export function createSyncDevice(
  repo: TrainingRepo,
  onSettings?: (changed: readonly SettingKey[]) => void,
): SyncDevice {
  return {
    loadCursor() {
      const { lastSeq, uploaded } = loadSync();
      return Promise.resolve({ lastSeq, uploaded });
    },
    saveCursor(cursor) {
      saveSync({ ...loadSync(), lastSeq: cursor.lastSeq, uploaded: cursor.uploaded });
      return Promise.resolve();
    },
    async merge(batch) {
      await mergeRecordsOf(
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
      const changed = mergeSyncedSettings(batch.settings);
      if (changed.length > 0) onSettings?.(changed);
    },
    async collect(full) {
      const legacyPlays = await ensureLegacyPlays(repo);
      const pending = await repo.pendingRecords();
      const settingsAt = latestOwnSettingStamp(deviceId());
      const records = full ? await repo.dumpRecords() : pending;
      const nothing = records.attempts.length === 0 && records.sessions.length === 0;
      if (!full && nothing && settingsAt <= loadSync().settingsAt) {
        return { batches: [], done: () => Promise.resolve() };
      }
      const state = {
        progress: loadProgress(),
        exams: loadExamRecords(),
        legacyPlays,
        settings: stampedSettings(),
      };
      return {
        batches: buildBatches(deviceId(), state, records),
        async done() {
          await repo.markPushed(pending.entries);
          saveSync({ ...loadSync(), settingsAt });
        },
      };
    },
  };
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
): Promise<SyncOutcome> {
  return syncOnce(createSyncDevice(repo, onSettings), server, codec);
}
