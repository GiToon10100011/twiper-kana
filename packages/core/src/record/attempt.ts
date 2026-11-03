import { lineResultOf } from '../drill/result';
import type { InputSessionState } from '../input/types';
import { classifyMistake } from '../kana/classify';
import type { AttemptFlag, AttemptRecord } from './types';

export interface AttemptMeta {
  readonly id: string;
  readonly sessionId: string;
  readonly levelId: string;
  /** 줄이 나타난 시각 (세션 스냅샷과 같은 시계) */
  readonly shownAt: number;
  /** 줄을 끝낸 실제 시각 */
  readonly at: Date;
}

/** 끝난 입력 세션을 저장할 시도 기록으로 바꾼다 */
export function attemptRecordOf(session: InputSessionState, meta: AttemptMeta): AttemptRecord {
  const line = lineResultOf(session, meta.shownAt);
  const flags: AttemptFlag[] = [];
  if (session.romajiSuspected) flags.push('romaji-suspected');
  if (session.toggleSuspected) flags.push('toggle-suspected');
  if (session.readingAccepted) flags.push('reading-only');
  // 끝낸 줄인데 정답 시각이 없으면 맞추지 못하고 틀린 채 낸 것이다 (submitInputSession)
  const submittedWrong = session.completedAt !== null && session.matchedAt === null;
  // 가타카나로 바꾸지 않은 글자도 변환 실수로 남긴다 (스킬 통계의 가타카나). 틀린 것으로는 세지 않는다
  const mistakes = [...session.errors, ...session.unconverted].sort((a, b) => a.t - b.t);

  let previous = meta.shownAt;
  const unitMs = session.unitTimes.map((t) => {
    if (t === null) return null;
    const ms = Math.max(0, t - previous);
    previous = t;
    return ms;
  });

  return {
    id: meta.id,
    sessionId: meta.sessionId,
    levelId: meta.levelId,
    at: meta.at.toISOString(),
    target: line.target,
    ...(session.rubies.length > 0 ? { surface: session.surface.join('') } : {}),
    input: session.raw.join(''),
    result: submittedWrong ? 'wrong' : session.errors.length === 0 ? 'correct' : 'corrected',
    judge: session.judge,
    reactionMs: line.reactionMs,
    elapsedMs: line.elapsedMs,
    unitMs,
    mistakes: mistakes.map(({ index, expected, actual, cause }) => ({
      index,
      expected,
      actual,
      cause,
      kind: classifyMistake(expected, actual),
    })),
    corrections: new Set(session.errors.map((error) => error.index)).size,
    flags,
  };
}
