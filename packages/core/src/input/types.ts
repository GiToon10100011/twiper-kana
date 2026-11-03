import type { RubySpan } from '../text/ruby';

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

/**
 * continued: 틀린 글자 뒤에 다음 글자를 입력함 / deleted: 틀린 글자를 지움 /
 * committed: 목표와 다른 글자로 確定함 (다른 한자 등), 또는 틀린 채 낸 줄에 남은 틀린 글자 (치지 않은 글자는 actual이 '') /
 * unconverted: 읽기는 맞지만 가타카나로 바꾸지 않고 確定함. 틀린 것으로 세지 않고 변환 기록으로만 남긴다
 */
export type InputErrorCause = 'continued' | 'deleted' | 'committed' | 'unconverted';

/**
 * 값을 다 쳤지만 아직 다음 문제로 넘어가지 않은 이유. 화면 안내에 쓴다.
 * commit: 確定만 누르면 됨 / convert: 읽기는 맞음, 후보에서 목표 표기를 골라야 함 /
 * confirm: 읽기는 다 맞게 確定했지만 후보에서 바꾸지 않음, 한 번 더 누르면 정답으로 넘어감 /
 * submit: 목표와 다르게 確定함, 고쳐도 되고 한 번 더 누르면 틀린 채 넘어감 (submitWrong) /
 * fix: 목표와 다르게 確定함, 지우고 다시 쳐야 함
 */
export type PendingStep = 'commit' | 'convert' | 'confirm' | 'submit' | 'fix';

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
  /** 맞춰 볼 목표 글자. 한자 표기(`{時々|ときどき}`)는 읽기로 펼쳐 둔다 */
  readonly target: readonly string[];
  /** 確定해야 하는 표기 글자. 한자 표기가 없으면 target과 같다 */
  readonly surface: readonly string[];
  /** target 안에서 한자 표기가 차지하는 자리 */
  readonly rubies: readonly RubySpan[];
  readonly judge: JudgeMode;
  /** 입력값을 target에 맞춰 본 것. 그 표기로 변환한 한자는 읽기로 되돌려 둔다 */
  readonly value: readonly string[];
  /** 입력창의 실제 값 */
  readonly raw: readonly string[];
  /** 한자 표기마다 그 한자로 변환해 넣었는지 (읽기만 친 자리는 false) */
  readonly converted: readonly boolean[];
  readonly composing: boolean;
  /** 목표와 일치하는 선두 문자 수 */
  readonly matched: number;
  readonly errors: readonly InputError[];
  /** 읽기는 맞지만 가타카나로 바꾸지 않고 確定한 글자 (cause 'unconverted'). errors와 달리 틀린 것으로 세지 않는다 */
  readonly unconverted: readonly InputError[];
  /** 위치별로 이미 오류로 기록한 문자 (중복 기록 방지) */
  readonly flagged: readonly (string | null)[];
  /** 목표의 각 문자가 올바르게 입력된 시각 */
  readonly unitTimes: readonly (number | null)[];
  readonly startedAt: number | null;
  /**
   * 값이 처음 목표와 같아진 시각. 정답 시각이자 속도 측정 기준이다.
   * commit 판정은 確定한 시각이고, 읽기만 맞게 確定한 때도 남긴다 (한 번 더 누르면 정답으로 넘어가므로)
   */
  readonly matchedAt: number | null;
  /** 다음 문제로 넘어가도 되는 시각 (completeOnCommit이면 確定 후) */
  readonly completedAt: number | null;
  /** composing 판정에서도 確定까지 기다려 완료로 볼지 */
  readonly completeOnCommit: boolean;
  /** 한자 표기를 읽기대로 쳐도 맞다고 볼지 (InputSessionOptions.readingOk) */
  readonly readingOk: boolean;
  /** 틀린 채로도 한 번 더 눌러 낼 수 있는지 (InputSessionOptions.submitWrong) */
  readonly submitWrong: boolean;
  /** 읽기만 맞게 確定한 줄을 한 번 더 눌러 정답으로 넘겼다 (후보에서 바꾸지 않음) */
  readonly readingAccepted: boolean;
  /**
   * 가나 목표를 입력하는 중에 라틴 문자가 그 자리에서 가나로 바뀜(k → か) → 로마자 키보드 사용 추정
   * (기록용, 한 번 켜지면 유지). かな 자판 ABC 모드의 영문자는 가나로 바뀌지 않아 해당하지 않는다
   */
  readonly romajiSuspected: boolean;
  /** 끝 글자가 같은 키 안에서 제자리 교체됨 → 토글(연타) 입력 추정 (기록용, 한 번 켜지면 유지) */
  readonly toggleSuspected: boolean;
  /**
   * 지금도 로마자 키보드로 치는 것 같음 (안내문용).
   * 라틴 문자가 보이면 켜지고, かな 자판으로만 나오는 입력이 오면 꺼진다 (키보드를 바꾼 뒤)
   */
  readonly romajiActive: boolean;
  /** 지금도 연타로 치는 것 같음 (안내문용). 연타가 보이면 켜지고, 플릭으로만 나오는 입력이 오면 꺼진다 */
  readonly toggleActive: boolean;
}

/**
 * todo: 아직 / correct: 맞음 / pending: 아직 바뀔 수 있는 중간 상태 /
 * unconverted: 읽기는 맞지만 가타카나·한자로 바꾸지 않고 確定함 (밑줄로 보인다) / wrong: 틀림
 */
export type CharStatus = 'todo' | 'correct' | 'pending' | 'unconverted' | 'wrong';

export interface InputSessionOptions {
  /**
   * composing 판정에서도 確定(조합 끝)을 기다려 완료로 본다. 정답 시각은 matchedAt에 따로 남는다.
   * iOS에서는 조합 중에 입력창을 비우면 입력이 끊기므로 훈련 화면은 이 옵션을 켠다 (결정 0001).
   */
  completeOnCommit?: boolean;
  /**
   * 한자 표기를 읽기(가나)대로 쳐도 바로 맞다 (설정 「한자는 바꿔야 정답」을 끈 경우, 2026-10-26 사용자 제안).
   * 끄면 읽기대로 確定했을 때 안내하고, 한 번 더 눌러야 맞다 (submitInputSession). 가타카나는 늘 그렇다
   */
  readingOk?: boolean;
  /**
   * 틀린 채 確定한 줄도 한 번 더 눌러 내고 넘어갈 수 있다. 틀린 글자는 기록한다.
   * 문장 연습은 다시 치게 하지 않는다 (2026-11-03 사용자 결정)
   */
  submitWrong?: boolean;
}
