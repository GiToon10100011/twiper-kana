import {
  countFinishedSessions,
  legacyPlaysOf,
  mergeLegacyPlays,
  playsOf,
  type ExamMode,
  type ExamRecords,
  type LegacyPlays,
  type PlayCounts,
  type Progress,
  type SessionRecord,
  type TrainingRepo,
} from '@twiper/core';
import { deviceId } from './device';
import { examLevelId, loadExamRecords, replaceExamPlays } from './examRecords';
import { loadProgress, replacePlays } from './progress';

const LEGACY_KEY = 'twiper.legacyPlays.v1';

/**
 * 플레이·응시 횟수는 「끝난 세션 수 + 모든 기기의 옛 횟수 가운데 큰 값」으로 센다 (동기화 설계 §4.3).
 * 옛 횟수는 세션을 남기기 전에 진도·종합 테스트 기록에만 셌던 횟수이고, 기기마다 한 번 만든다.
 * 그래서 두 기기의 기록을 합치면 횟수가 더해지고, 같은 파일을 다시 합쳐도 늘지 않는다
 */

const isCounts = (value: unknown): value is PlayCounts =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);

/** 저장해 둔 값이나 가져온 백업 파일에서 옛 횟수만 골라낸다 */
export function parseLegacyPlays(value: unknown): LegacyPlays {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, counts]) => isCounts(counts)));
}

export function loadLegacyPlays(): LegacyPlays {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? parseLegacyPlays(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** 저장했으면 true */
function saveLegacyPlays(legacy: LegacyPlays): boolean {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    return true;
  } catch {
    return false;
  }
}

/** 진도·종합 테스트 기록에 적힌 횟수 (레벨 id, test-<종목>) */
export function recordedPlays(progress: Progress, exams: ExamRecords): Record<string, number> {
  const plays: Record<string, number> = {};
  for (const [id, record] of Object.entries(progress)) plays[id] = record.plays;
  for (const [mode, record] of Object.entries(exams) as [ExamMode, { plays: number }][]) {
    plays[examLevelId(mode)] = record.plays;
  }
  return plays;
}

/**
 * 이 기기의 옛 횟수를 아직 만들지 않았으면 만든다. 레벨을 칠 때마다 횟수와 세션이 함께 1씩 늘므로
 * 언제 만들어도 세션으로 세기 시작한 때와 같은 값이다. 다른 기록을 합치기 전에 불러야 한다
 */
export async function ensureLegacyPlays(repo: TrainingRepo): Promise<LegacyPlays> {
  const legacy = loadLegacyPlays();
  const me = deviceId();
  if (legacy[me]) return legacy;
  const mine = legacyPlaysOf(
    recordedPlays(loadProgress(), loadExamRecords()),
    await repo.finishedSessionCounts(),
  );
  const updated = { ...legacy, [me]: mine };
  saveLegacyPlays(updated);
  return updated;
}

/**
 * legacyPlays가 없는 옛 백업 파일의 옛 횟수: 파일의 횟수 − 파일의 끝난 세션 수.
 * 가져오는 기기의 몫에 큰 값으로 합친다 (동기화 설계 §4.3)
 */
export function legacyOfOldBackup(
  progress: Progress,
  exams: ExamRecords,
  sessions: readonly SessionRecord[],
): LegacyPlays {
  return {
    [deviceId()]: legacyPlaysOf(recordedPlays(progress, exams), countFinishedSessions(sessions)),
  };
}

/** 옛 횟수를 합쳐 저장한다. 합친 값과, 바뀌었는지·저장했는지를 돌려준다 */
export function mergeLegacy(
  current: LegacyPlays,
  incoming: LegacyPlays,
): { legacy: LegacyPlays; changed: boolean; persisted: boolean } {
  const legacy = mergeLegacyPlays(current, incoming);
  const changed = JSON.stringify(legacy) !== JSON.stringify(current);
  return { legacy, changed, persisted: !changed || saveLegacyPlays(legacy) };
}

/**
 * 끝난 세션 수와 옛 횟수로 진도·종합 테스트 기록의 횟수를 다시 맞춘다. 기록을 합친 뒤에 부른다.
 * 횟수를 줄이지는 않는다 (IndexedDB를 쓸 수 없어 세션이 사라진 기기에서 횟수가 줄지 않게)
 */
export async function recountPlays(
  repo: TrainingRepo,
  legacy: LegacyPlays,
): Promise<{ changed: number; persisted: boolean }> {
  const finished = await repo.finishedSessionCounts();
  const progress = loadProgress();
  const exams = loadExamRecords();
  const levels = replacePlays((id) =>
    Math.max(progress[id]?.plays ?? 0, playsOf(id, finished, legacy)),
  );
  const tests = replaceExamPlays((mode) =>
    Math.max(exams[mode]?.plays ?? 0, playsOf(examLevelId(mode), finished, legacy)),
  );
  return {
    changed: levels.changed + tests.changed,
    persisted: levels.persisted && tests.persisted,
  };
}
