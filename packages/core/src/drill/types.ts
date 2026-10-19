import type { MistakeKind } from '../kana/classify';

/**
 * 한 레벨의 줄 드릴 설정. 콘텐츠 패키지의 레벨 정의가 만든다.
 * 출제 단위(unit)는 입력 규칙 하나다. 보통 가나 한 글자지만 요음은 'きゃ'처럼 두 글자다.
 */
export interface DrillSpec {
  /** 이 레벨에서 새로 익히는 단위. 비어 있으면 모든 줄을 단어로 낸다 */
  readonly focus: readonly string[];
  /** 섞어서 복습할 이전 레벨 단위 */
  readonly review: readonly string[];
  /** 있으면 기본 줄의 홀수 번째 줄을 단어 하나로 낸다 (focus가 비면 모든 줄) */
  readonly words?: readonly string[];
  /** 한 줄의 단위 수 */
  readonly lineLength: number;
  /** 기본 줄 수. 틀린 단위를 다시 내느라 몇 줄 늘어날 수 있다 */
  readonly lineCount: number;
  /** 단위마다 복습 단위를 고를 확률 (0–1) */
  readonly reviewRatio: number;
}

/** 한 줄을 푼 결과. 입력 세션에서 lineResultOf로 만든다. */
export interface LineResult {
  readonly target: string;
  /** 목표 글자 수 */
  readonly units: number;
  /** 한 번도 틀리지 않은 글자 수 */
  readonly firstTryUnits: number;
  /**
   * 틀린 적이 있는 것. lineResultOf는 목표 글자를, advanceDrill은 그 글자가 속한 출제 단위를 담는다
   * (요음 'きゃ'의 ゃ를 틀리면 'きゃ').
   */
  readonly missed: readonly string[];
  /** 틀린 적이 있는 목표 글자의 위치 (code point 단위, 오름차순) */
  readonly missedIndexes: readonly number[];
  /** 틀린 종류별 횟수 */
  readonly mistakeKinds: Readonly<Partial<Record<MistakeKind, number>>>;
  /** 줄이 나타난 뒤 첫 입력까지 (ms) */
  readonly reactionMs: number | null;
  /** 줄이 나타난 뒤 값이 목표와 같아질 때까지 (ms). 確定을 누르는 시간은 빠진다 */
  readonly elapsedMs: number | null;
  readonly romajiSuspected: boolean;
  readonly toggleSuspected: boolean;
}

export interface DrillRetry {
  readonly unit: string;
  /** 이 번호의 줄부터 다시 낸다 (0부터) */
  readonly due: number;
}

export interface DrillState {
  readonly spec: DrillSpec;
  /** 난수 상태 */
  readonly rng: number;
  /** 지금 풀 줄. done이면 마지막으로 낸 줄 */
  readonly line: string;
  /** 지금 줄을 이루는 출제 단위 (이어 붙이면 line) */
  readonly lineUnits: readonly string[];
  readonly results: readonly LineResult[];
  readonly retries: readonly DrillRetry[];
  /** 아직 내지 않은 이번 레벨 단위 (섞은 순서) */
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
  /** 틀린 단위와 횟수. 많은 순, 같으면 먼저 틀린 순 */
  readonly missed: readonly { readonly char: string; readonly count: number }[];
  /** 틀린 종류별 횟수 */
  readonly mistakeKinds: Readonly<Partial<Record<MistakeKind, number>>>;
  readonly romajiSuspected: boolean;
  readonly toggleSuspected: boolean;
}
