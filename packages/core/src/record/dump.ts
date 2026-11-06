import type { InputErrorCause, JudgeMode } from '../input/types';
import type { AttemptFlag, AttemptRecord, SessionRecord } from './types';

/**
 * 기록 가져오기에서 파일로 읽은 값을 확인한다.
 * 다른 기기·예전 버전에서 내보낸 파일도 받으므로, 화면과 통계가 읽는 필드의 모양만 본다.
 */

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberOrNull = (value: unknown) => value === null || isNumber(value);

/** 날짜로 읽히는 시각 문자열 (ISO 8601) */
const isTime = (value: unknown): value is string =>
  isString(value) && !Number.isNaN(Date.parse(value));

// 받을 값의 표. 타입에 값이 늘거나 바뀌면 여기서 컴파일이 깨지도록 Record로 둔다
const CAUSES: Record<InputErrorCause, true> = { continued: true, deleted: true, committed: true };
const JUDGES: Record<JudgeMode, true> = { composing: true, commit: true };
const FLAGS: Record<AttemptFlag, true> = { 'romaji-suspected': true, 'toggle-suspected': true };

const isOneOf = <K extends string>(table: Record<K, true>, value: unknown): value is K =>
  isString(value) && Object.hasOwn(table, value);

const isMistake = (value: unknown) =>
  isObject(value) &&
  isNumber(value.index) &&
  isString(value.expected) &&
  isString(value.actual) &&
  isOneOf(CAUSES, value.cause) &&
  (value.kind === undefined || isString(value.kind));

/** 한 줄을 푼 기록 모양인지 */
export function isAttemptRecord(value: unknown): value is AttemptRecord {
  if (!isObject(value)) return false;
  const { unitMs, mistakes, flags } = value;
  return (
    [value.id, value.sessionId, value.levelId, value.target, value.input].every(isString) &&
    isTime(value.at) &&
    (value.surface === undefined || isString(value.surface)) &&
    (value.result === 'correct' || value.result === 'corrected') &&
    isOneOf(JUDGES, value.judge) &&
    isNumberOrNull(value.reactionMs) &&
    isNumberOrNull(value.elapsedMs) &&
    Array.isArray(unitMs) &&
    unitMs.every(isNumberOrNull) &&
    Array.isArray(mistakes) &&
    mistakes.every(isMistake) &&
    isNumber(value.corrections) &&
    Array.isArray(flags) &&
    flags.every((flag) => isOneOf(FLAGS, flag))
  );
}

const isSummary = (value: unknown) =>
  isObject(value) &&
  [value.lines, value.units, value.firstTryUnits, value.accuracy, value.totalMs].every(isNumber) &&
  isNumberOrNull(value.kpm) &&
  Array.isArray(value.missed) &&
  value.missed.every((miss) => isObject(miss) && isString(miss.char) && isNumber(miss.count)) &&
  isObject(value.mistakeKinds) &&
  Object.values(value.mistakeKinds).every(isNumber) &&
  typeof value.romajiSuspected === 'boolean' &&
  typeof value.toggleSuspected === 'boolean';

/** 레벨 한 판의 기록 모양인지 */
export function isSessionRecord(value: unknown): value is SessionRecord {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.levelId) &&
    isTime(value.startedAt) &&
    (value.endedAt === null || isTime(value.endedAt)) &&
    (value.summary === null || isSummary(value.summary))
  );
}

/** 가져온 세션으로 지금 세션을 바꿀지. 없던 세션이거나, 지금 것은 끝나지 않았는데 가져온 것은 끝났으면 바꾼다 */
export const replacesSession = (
  current: SessionRecord | undefined,
  incoming: SessionRecord,
): boolean => current === undefined || (current.endedAt === null && incoming.endedAt !== null);
