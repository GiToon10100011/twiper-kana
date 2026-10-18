/** 입력창의 한 시점. 플랫폼 어댑터(DOM, RN)가 만들어 core로 넘긴다. */
export interface InputSnapshot {
  /** 단조 증가 시각(ms). 웹에서는 performance.now() */
  t: number;
  /** 입력창의 전체 값 (확정부 + 조합부) */
  value: string;
  /** IME 조합이 진행 중이면 true */
  composing: boolean;
}

/**
 * composing: 조합 중이어도 값이 목표와 같아지면 정답 (가나만으로 된 목표)
 * commit: 조합이 끝난(確定) 값이 목표와 같아야 정답 (변환이 필요한 목표)
 */
export type JudgeMode = 'composing' | 'commit';

/** continued: 틀린 글자 뒤에 다음 글자를 입력함 / deleted: 틀린 글자를 지움 */
export type InputErrorCause = 'continued' | 'deleted';

export interface InputError {
  /** 목표 문자열에서의 위치 (code point 단위) */
  index: number;
  /** 목표 문자. 목표 길이를 넘어선 초과 입력이면 빈 문자열 */
  expected: string;
  actual: string;
  cause: InputErrorCause;
  t: number;
}

export interface InputSessionState {
  readonly target: readonly string[];
  readonly judge: JudgeMode;
  readonly value: readonly string[];
  readonly composing: boolean;
  /** 목표와 일치하는 선두 문자 수 */
  readonly matched: number;
  readonly errors: readonly InputError[];
  /** 위치별로 이미 오류로 기록한 문자 (중복 기록 방지) */
  readonly flagged: readonly (string | null)[];
  /** 목표의 각 문자가 올바르게 입력된 시각 */
  readonly unitTimes: readonly (number | null)[];
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  /** 가나 목표를 입력하는 중에 라틴 문자가 나타남 → 로마자 키보드 사용 추정 */
  readonly romajiSuspected: boolean;
  /** 끝 글자가 같은 키 안에서 제자리 교체됨 → 토글(연타) 입력 추정 */
  readonly toggleSuspected: boolean;
}

export type CharStatus = 'todo' | 'correct' | 'pending' | 'wrong';
