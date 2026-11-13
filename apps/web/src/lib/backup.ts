import {
  dayKey,
  isAttemptRecord,
  isSessionRecord,
  type AttemptRecord,
  type LegacyPlays,
  type SessionRecord,
  type TrainingRepo,
} from '@twiper/core';
import {
  loadExamRecords,
  mergeExamRecords,
  parseExamRecords,
  type ExamRecords,
} from './examRecords';
import {
  ensureLegacyPlays,
  legacyOfOldBackup,
  mergeLegacy,
  parseLegacyPlays,
  recountPlays,
} from './plays';
import { loadProgress, mergeProgress, parseProgress, type Progress } from './progress';

const FORMAT = 'twiper-backup';
const VERSION = 1;

/**
 * 기록 백업 파일. 진도·종합 테스트 기록(localStorage)과 시도·세션 기록(IndexedDB)을 한 파일에 담는다.
 * iOS Safari는 오래 열지 않은 사이트의 저장소를 지울 수 있고, Safari 탭과 홈 화면 앱은 저장소가 따로라서
 * 기록을 지키고 옮기는 길이 필요하다 (계획 §13). 설정은 기록이 아니므로 담지 않는다
 */
export interface Backup {
  readonly format: typeof FORMAT;
  readonly version: typeof VERSION;
  /** ISO 8601 */
  readonly exportedAt: string;
  readonly progress: Progress;
  readonly exams: ExamRecords;
  readonly attempts: readonly AttemptRecord[];
  readonly sessions: readonly SessionRecord[];
  /** 기기별 옛 횟수 (lib/plays). 2026-11-13 이전 파일에는 없다 */
  readonly legacyPlays?: LegacyPlays;
}

export async function createBackup(repo: TrainingRepo, now = new Date()): Promise<Backup> {
  const legacyPlays = await ensureLegacyPlays(repo);
  const { attempts, sessions } = await repo.dumpRecords();
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: now.toISOString(),
    progress: loadProgress(),
    exams: loadExamRecords(),
    attempts,
    sessions,
    legacyPlays,
  };
}

/** twiper-backup-2026-11-06.json (기기 시간대의 날짜) */
export const backupFileName = (now = new Date()): string => `twiper-backup-${dayKey(now)}.json`;

/** 백업 파일을 읽는다. twiper 백업이 아니면 null. 모양이 맞지 않는 기록은 하나씩 빼고 나머지는 살린다 */
export function parseBackup(text: string): Backup | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const file = value as Record<string, unknown>;
  if (file.format !== FORMAT || file.version !== VERSION) return null;
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
    progress: parseProgress(file.progress),
    exams: parseExamRecords(file.exams),
    attempts: Array.isArray(file.attempts) ? file.attempts.filter(isAttemptRecord) : [],
    sessions: Array.isArray(file.sessions) ? file.sessions.filter(isSessionRecord) : [],
    ...(file.legacyPlays === undefined ? {} : { legacyPlays: parseLegacyPlays(file.legacyPlays) }),
  };
}

export interface RestoreResult {
  /** 새로 더한 연습 기록(줄) 수 */
  readonly attempts: number;
  /** 진도·최고 기록이나 세션 기록이 바뀌었는지 */
  readonly changed: boolean;
  /** 합친 기록이 기기에 남았는지. 쓰지 못했거나 메모리 저장소에 합쳤으면 false (다시 열면 사라진다) */
  readonly persisted: boolean;
}

/**
 * 백업을 지금 기록에 합친다. 지금 기록은 지우지 않고, 같은 파일을 두 번 합쳐도 늘지 않는다.
 * 플레이·응시 횟수는 합친 뒤 끝난 세션 수와 옛 횟수로 다시 세므로, 다른 기기의 백업을 가져오면 더해진다
 */
export async function restoreBackup(backup: Backup, repo: TrainingRepo): Promise<RestoreResult> {
  // 이 기기의 옛 횟수는 세션이 늘기 전에 만든다
  const current = await ensureLegacyPlays(repo);
  const legacy = mergeLegacy(
    current,
    backup.legacyPlays ?? legacyOfOldBackup(backup.progress, backup.exams, backup.sessions),
  );
  const levels = mergeProgress(backup.progress);
  const exams = mergeExamRecords(backup.exams);
  const added = await repo.mergeRecords(backup);
  const recount = await recountPlays(repo, legacy.legacy);
  return {
    attempts: added.attempts,
    changed:
      legacy.changed || levels.changed + exams.changed + added.sessions + recount.changed > 0,
    persisted:
      legacy.persisted &&
      levels.persisted &&
      exams.persisted &&
      added.persisted &&
      recount.persisted,
  };
}

/**
 * 파일을 기기에 저장한다. iPhone은 공유 창(「파일에 저장」)을 띄우고, 공유할 수 없으면 내려받는다.
 * 공유 창은 누른 그 자리에서 열어야 하므로 파일은 미리 만들어 둔다
 */
export async function saveFile(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // 사용자가 공유 창을 닫았으면 그만두고, 그 밖의 실패는 내려받기로 넘어간다
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  // 내려받기가 시작되기 전에 주소를 거두지 않도록 잠시 둔다
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
