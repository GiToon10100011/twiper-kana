export type FlickDirection = 'tap' | 'left' | 'up' | 'right' | 'down';

/** 키보드의 입력 모드: かな / 숫자·기호(☆123) / 영문(ABC) */
export type GuideLayerId = 'kana' | 'number' | 'alpha';

export interface GuideKey {
  /** 레이어 안에서 유일한 식별자 */
  id: string;
  /** 키에 표시된 글자 */
  label: string;
  /** 키패드에서의 위치 (0부터, 4행 × 3열) */
  row: number;
  col: number;
  outputs: Partial<Record<FlickDirection, string>>;
  /** 문헌으로 확정하지 못해 실기 확인이 필요한 방향 */
  unverified?: readonly FlickDirection[];
}

export interface GuideLayer {
  /** 이 모드로 바꾸는 키에 표시된 글자 */
  switchLabel: string;
  keys: readonly GuideKey[];
}

/** 직전 문자를 탁음·반탁음·소문자로 바꾸는 키 (iOS의 小゛゜) */
export interface GuideModifier {
  label: string;
  row: number;
  col: number;
  /** 탭할 때마다 순환하는 변형 계열. chars[0]이 기본 문자 */
  cycles: readonly { chars: readonly string[]; unverified?: boolean }[];
  /**
   * 키를 플릭해 한 번에 변형하는 동작의 예. 전부 실기 확인 대상이다.
   * iOS 기본 키보드에는 없다(탭 순환만 지원). Gboard 계열은 ゛·゜·小를 플릭으로 바로 적용한다.
   */
  direct: readonly { dir: FlickDirection; base: string; out: string }[];
}

/**
 * 실제 키보드가 "어떤 동작에 어떤 문자를 내는지"를 적은 참조 데이터.
 * 입력을 처리하는 데 쓰지 않고, 튜토리얼 도해·힌트·오류 분류의 근거로만 쓴다.
 */
export interface KeyboardGuide {
  id: string;
  name: string;
  layers: Record<GuideLayerId, GuideLayer>;
  modifier: GuideModifier;
}

/** 문자 하나를 입력하기 위한 동작 한 단계 */
export type InputStep =
  | {
      kind: 'key';
      layer: GuideLayerId;
      keyId: string;
      label: string;
      dir: FlickDirection;
      out: string;
    }
  | { kind: 'modifier'; dir: FlickDirection; times: number; out: string };

/** 가이드가 주장하는 "이 동작들을 하면 이 문자가 나온다" 한 건 */
export interface GuideClaim {
  id: string;
  layer: GuideLayerId;
  steps: readonly InputStep[];
  expected: string;
  unverified: boolean;
}
