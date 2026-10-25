/** 한자 표기와 그 읽기: `{今日|きょう}` (계획 §11). 표기 밖의 글자는 그대로 읽는다 */
const RUBY = /\{([^{}|]+)\|([^{}|]+)\}/gu;

/** 읽기로 펼친 목표에서 한자 표기 하나가 차지하는 자리 */
export interface RubySpan {
  /** 읽기 글자 위치 [start, end) */
  readonly start: number;
  readonly end: number;
  /** 確定해야 하는 표기 */
  readonly surface: string;
}

export interface RubyText {
  /** 한자 표기를 읽기로 펼친 목표 글자들. 가나는 그대로다 */
  readonly chars: readonly string[];
  /** 確定해야 하는 표기 전체 */
  readonly surface: string;
  readonly rubies: readonly RubySpan[];
}

/** `{時々|ときどき}は` → 읽기 글자 ときどきは, 표기 時々は, 時々는 읽기 0–4 */
export function parseRuby(text: string): RubyText {
  const chars: string[] = [];
  const rubies: RubySpan[] = [];
  let surface = '';
  let last = 0;
  for (const match of text.matchAll(RUBY)) {
    const plain = text.slice(last, match.index);
    chars.push(...plain);
    surface += plain;
    const [, base = '', reading = ''] = match;
    const start = chars.length;
    chars.push(...reading);
    rubies.push({ start, end: chars.length, surface: base });
    surface += base;
    last = match.index + match[0].length;
  }
  const rest = text.slice(last);
  chars.push(...rest);
  surface += rest;
  return { chars, surface, rubies };
}

/** 화면·결과에 보일 표기: `{時々|ときどき}は` → 時々は */
export function rubySurface(text: string): string {
  return text.replace(RUBY, '$1');
}

/** 읽기: `{時々|ときどき}は` → ときどきは */
export function rubyReading(text: string): string {
  return text.replace(RUBY, '$2');
}
