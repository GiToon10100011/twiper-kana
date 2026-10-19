import type { DrillSummary } from '../drill/types';
import type { InputErrorCause, JudgeMode } from '../input/types';
import type { MistakeKind } from '../kana/classify';

export type AttemptFlag = 'romaji-suspected' | 'toggle-suspected';

/**
 * 한 줄을 푼 기록 (계획 §12 Attempt). 원본 로그이며, 통계는 이 로그에서 다시 계산한다.
 * 동기화에 대비해 id는 기기와 무관하게 유일하고 시각순으로 정렬되는 ULID를 쓴다.
 */
export interface AttemptRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly levelId: string;
  /** 줄을 끝낸 시각 (ISO 8601) */
  readonly at: string;
  readonly target: string;
  readonly input: string;
  /** correct: 한 번도 틀리지 않음 / corrected: 틀렸다가 고쳐서 통과 */
  readonly result: 'correct' | 'corrected';
  readonly judge: JudgeMode;
  readonly reactionMs: number | null;
  readonly elapsedMs: number | null;
  /** 목표 글자마다 바로 앞 글자(첫 글자는 줄이 나타난 때)부터 맞게 입력되기까지 걸린 ms */
  readonly unitMs: readonly (number | null)[];
  readonly mistakes: readonly {
    readonly index: number;
    readonly expected: string;
    readonly actual: string;
    readonly cause: InputErrorCause;
    /** 2026-10-18 이전 기록에는 없다 */
    readonly kind?: MistakeKind;
  }[];
  /** 고쳐야 했던 자리 수 */
  readonly corrections: number;
  readonly flags: readonly AttemptFlag[];
}

/** 레벨 한 판. 시작할 때 endedAt·summary를 null로 저장하고 끝나면 덮어쓴다 */
export interface SessionRecord {
  readonly id: string;
  readonly levelId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly summary: DrillSummary | null;
}

/** 훈련 기록 저장소. 웹은 IndexedDB, 테스트는 메모리, 네이티브 앱은 SQLite로 구현한다 (계획 §13) */
export interface TrainingRepo {
  saveAttempt(attempt: AttemptRecord): Promise<void>;
  /** 같은 id면 덮어쓴다 */
  saveSession(session: SessionRecord): Promise<void>;
  /** 끝낸 세션, 최근에 시작한 순 */
  finishedSessions(levelId: string, limit: number): Promise<SessionRecord[]>;
  /** 세션의 시도, 저장한 순 */
  attemptsOf(sessionId: string): Promise<AttemptRecord[]>;
}
