import { isAttemptRecord, isSessionRecord } from '../record/dump';
import type { AttemptRecord, RecordDump, SessionRecord } from '../record/types';
import type { LegacyPlays } from './plays';
import type { ExamRecords, Progress } from './records';
import type { Stamp } from './stamp';

/** 이 앱이 읽고 쓰는 묶음 버전. 더 높은 버전을 만나면 받기를 멈춘다 (동기화 설계 §4.2) */
export const SYNC_VERSION = 1;

/**
 * 기기가 올리는 묶음. 그 자체로 완결되어, 어느 순서로 몇 번 합쳐도 같은 상태에 이른다 (동기화 설계 §4.2).
 * 진도·종합 테스트 기록·옛 횟수·설정은 작아서 묶음마다 통째로 싣는다
 */
export interface SyncBatch {
  readonly format: 'twiper-sync';
  readonly version: number;
  /** 올린 기기 */
  readonly deviceId: string;
  readonly progress: Progress;
  readonly exams: ExamRecords;
  readonly legacyPlays: LegacyPlays;
  /** 설정 항목마다 값과 바꾼 때 (§4.4). 바꾼 때가 없는 항목은 싣지 않는다 */
  readonly settings: Readonly<Record<string, { readonly value: unknown; readonly stamp: Stamp }>>;
  readonly attempts: readonly AttemptRecord[];
  readonly sessions: readonly SessionRecord[];
}

/** 묶음마다 통째로 싣는 이 기기의 상태 */
export type SyncState = Pick<SyncBatch, 'progress' | 'exams' | 'legacyPlays' | 'settings'>;

/** 묶음 하나에 싣는 시도·세션 수. 시도 한 줄이 JSON으로 1KB 안팎이라 요청 한도(512KB) 안에 든다 */
export const BATCH_RECORDS = 200;

/** 기록을 묶음 여러 개로 나눈다. 묶음마다 상태를 함께 실어, 조각을 다시 이어 붙일 필요가 없다 */
export function buildBatches(
  deviceId: string,
  state: SyncState,
  records: RecordDump,
  maxRecords = BATCH_RECORDS,
): SyncBatch[] {
  const items = [
    ...records.attempts.map((attempt) => ({ attempt })),
    ...records.sessions.map((session) => ({ session })),
  ];
  const batches: SyncBatch[] = [];
  for (let start = 0; start === 0 || start < items.length; start += maxRecords) {
    const chunk = items.slice(start, start + maxRecords);
    batches.push({
      format: 'twiper-sync',
      version: SYNC_VERSION,
      deviceId,
      ...state,
      attempts: chunk.flatMap((item) => ('attempt' in item ? [item.attempt] : [])),
      sessions: chunk.flatMap((item) => ('session' in item ? [item.session] : [])),
    });
  }
  return batches;
}

/** 이 기기가 어디까지 받았는지 */
export interface SyncCursor {
  /** 마지막으로 받아 합친 묶음 번호 (없으면 0) */
  readonly lastSeq: number;
  /** 처음 켤 때의 전체 올리기를 마쳤는지 */
  readonly uploaded: boolean;
}

/** 기기 쪽 (웹은 localStorage·IndexedDB, 테스트는 메모리) */
export interface SyncDevice {
  loadCursor(): Promise<SyncCursor>;
  saveCursor(cursor: SyncCursor): Promise<void>;
  /** 받은 묶음을 합친다. 진도·종합 테스트 기록·옛 횟수·설정은 여기서 다시 검사한다 */
  merge(batch: SyncBatch): Promise<void>;
  /**
   * 올릴 묶음들. full이면 이 기기의 모든 기록을, 아니면 outbox와 바뀐 설정을 싣는다.
   * 올릴 것이 없으면 비어 있다. 다 올린 뒤 done()으로 outbox에서 지운다
   */
  collect(full: boolean): Promise<{
    readonly batches: readonly SyncBatch[];
    done(): Promise<void>;
  }>;
}

/** 서버가 돌려주는 묶음 하나 */
export interface SyncEnvelope<P> {
  readonly seq: number;
  readonly payload: P;
}

/** 서버 쪽. 번호는 커밋 순서대로 매긴다 (§4.6). S3는 fetch로, 테스트는 메모리로 구현한다 */
export interface SyncServer<P> {
  pull(after: number, limit: number): Promise<readonly SyncEnvelope<P>[]>;
  push(payload: P): Promise<number>;
}

/** 묶음 ↔ 서버에 보내는 값 (웹은 압축 + 암호화, §4.2) */
export interface SyncCodec<P> {
  encode(batch: SyncBatch): Promise<P>;
  decode(payload: P): Promise<unknown>;
}

export type SyncOutcome =
  | { readonly status: 'done'; readonly pulled: number; readonly pushed: number }
  /** 이 앱보다 높은 버전의 묶음을 만나 그 앞에서 멈췄다. 업데이트한 뒤 at번부터 다시 받는다 */
  | { readonly status: 'update-required'; readonly pulled: number; readonly at: number };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 받은 값이 twiper 묶음이면 기록을 하나씩 검사해 돌려준다. 더 높은 버전이면 'newer', 아니면 null */
function readBatch(value: unknown): SyncBatch | 'newer' | null {
  if (!isObject(value) || value.format !== 'twiper-sync' || typeof value.version !== 'number') {
    return null;
  }
  if (value.version > SYNC_VERSION) return 'newer';
  if (typeof value.deviceId !== 'string') return null;
  const objectOf = <T>(field: unknown): T => (isObject(field) ? field : {}) as T;
  return {
    format: 'twiper-sync',
    version: value.version,
    deviceId: value.deviceId,
    progress: objectOf(value.progress),
    exams: objectOf(value.exams),
    legacyPlays: objectOf(value.legacyPlays),
    settings: objectOf(value.settings),
    attempts: Array.isArray(value.attempts) ? value.attempts.filter(isAttemptRecord) : [],
    sessions: Array.isArray(value.sessions) ? value.sessions.filter(isSessionRecord) : [],
  };
}

/**
 * 한 번 주고받는다 (동기화 설계 §4.5): 받은 데 다음부터 끝까지 받아 합치고, 그다음 올린다.
 * 받은 묶음마다 커서를 저장하므로 도중에 끊겨도 받은 데까지는 남는다. 합치기(device.merge)가 실패하면
 * 커서를 그 앞에 두고 멈추므로, 다음에 그 묶음부터 다시 받는다. 올리다 끊기면 outbox가 남아
 * 다음에 다시 올린다 (같은 묶음을 두 번 올려도 합치기가 중복을 없앤다)
 */
export async function syncOnce<P>(
  device: SyncDevice,
  server: SyncServer<P>,
  codec: SyncCodec<P>,
  pageSize = 50,
): Promise<SyncOutcome> {
  let cursor = await device.loadCursor();
  let pulled = 0;
  for (;;) {
    const after = cursor.lastSeq;
    const page = await server.pull(after, pageSize);
    for (const { seq, payload } of page) {
      // 이미 받은 번호는 건너뛴다 (서버는 after보다 큰 번호만 주어야 한다)
      if (seq <= cursor.lastSeq) continue;
      const batch = readBatch(await codec.decode(payload));
      // 그 묶음과 뒤의 묶음은 합치지 않고, 커서도 그 앞까지만 둔다
      if (batch === 'newer') return { status: 'update-required', pulled, at: seq };
      if (batch) {
        await device.merge(batch);
        pulled += 1;
      }
      cursor = { ...cursor, lastSeq: seq };
      await device.saveCursor(cursor);
    }
    if (page.length < pageSize) break;
    // 꽉 찬 페이지인데 커서가 나아가지 않았으면 같은 페이지를 끝없이 받게 되므로 멈춘다
    if (cursor.lastSeq <= after) throw new Error('서버가 다음 묶음을 주지 않았다');
  }
  const { batches, done } = await device.collect(!cursor.uploaded);
  for (const batch of batches) await server.push(await codec.encode(batch));
  await done();
  if (!cursor.uploaded) await device.saveCursor({ ...cursor, uploaded: true });
  return { status: 'done', pulled, pushed: batches.length };
}
