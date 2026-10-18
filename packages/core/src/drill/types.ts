/** 한 레벨의 줄 드릴 설정. 콘텐츠 패키지의 레벨 정의가 만든다. */
export interface DrillSpec {
  /** 이 레벨에서 새로 익히는 문자 */
  readonly focus: readonly string[];
  /** 섞어서 복습할 이전 레벨 문자 */
  readonly review: readonly string[];
  /** 있으면 기본 줄의 홀수 번째 줄을 단어 하나로 낸다 */
  readonly words?: readonly string[];
  /** 한 줄의 글자 수 */
  readonly lineLength: number;
  /** 기본 줄 수. 틀린 글자를 다시 내느라 몇 줄 늘어날 수 있다 */
  readonly lineCount: number;
  /** 글자마다 복습 문자를 고를 확률 (0–1) */
  readonly reviewRatio: number;
}

/** 한 줄을 푼 결과. 입력 세션에서 lineResultOf로 만든다. */
export interface LineResult {
  readonly target: string;
  /** 목표 글자 수 */
  readonly units: number;
  /** 한 번도 틀리지 않은 글자 수 */
  readonly firstTryUnits: number;
  /** 틀린 적이 있는 목표 글자 (위치마다 한 번) */
  readonly missed: readonly string[];
  /** 줄이 나타난 뒤 첫 입력까지 (ms) */
  readonly reactionMs: number | null;
  /** 줄이 나타난 뒤 값이 목표와 같아질 때까지 (ms). 確定을 누르는 시간은 빠진다 */
  readonly elapsedMs: number | null;
  readonly romajiSuspected: boolean;
  readonly toggleSuspected: boolean;
}

export interface DrillRetry {
  readonly char: string;
  /** 이 번호의 줄부터 다시 낸다 (0부터) */
  readonly due: number;
}

export interface DrillState {
  readonly spec: DrillSpec;
  /** 난수 상태 */
  readonly rng: number;
  /** 지금 풀 줄. done이면 마지막으로 낸 줄 */
  readonly line: string;
  readonly results: readonly LineResult[];
  readonly retries: readonly DrillRetry[];
  /** 아직 내지 않은 이번 레벨 문자 (섞은 순서) */
  readonly bag: readonly string[];
  readonly done: boolean;
}

export interface DrillSummary {
  readonly lines: number;
  readonly units: number;
  readonly firstTryUnits: number;
  /** 첫 시도 정확도 (0–1) */
  readonly accuracy: number;
  /** 가나/분. 잴 수 있는 줄이 없으면 null */
  readonly kpm: number | null;
  /** 잴 수 있는 줄의 elapsedMs 합 */
  readonly totalMs: number;
  /** 틀린 글자와 횟수. 많은 순, 같으면 먼저 틀린 순 */
  readonly missed: readonly { readonly char: string; readonly count: number }[];
  readonly romajiSuspected: boolean;
  readonly toggleSuspected: boolean;
}
