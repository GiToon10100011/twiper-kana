import type { InputError, InputSnapshot, JudgeMode } from '@twiper/core';
import type { EmitMode, RawInputEvent } from '../../platform/input/imeAdapter';

export type InputSource = 'A' | 'B';

/** 문제를 넘길 때 조합을 끊는 방법 */
export type ResetStrategy = 'swap' | 'assign' | 'blurFocus' | 'commitOnly';

export interface LoggedEvent extends RawInputEvent {
  src: InputSource;
}

export interface LoggedSnapshot extends InputSnapshot {
  src: InputSource;
  /** 이 스냅샷을 받은 입력 세션의 번호. 줄을 넘기거나 다시 시작할 때마다 1씩 늘어난다 */
  session: number;
  line: number;
  /** 리셋 도중이거나 비활성 입력창에서 온 스냅샷이라 세션에 넣지 않았으면 true */
  ignored: boolean;
}

export interface LineResult {
  /** 이 결과를 만든 입력 세션의 번호 (LoggedSnapshot.session과 대응) */
  session: number;
  round: number;
  line: number;
  target: string;
  judge: JudgeMode;
  strategy: ResetStrategy;
  emit: EmitMode;
  elapsedMs: number | null;
  errors: InputError[];
  romajiSuspected: boolean;
  toggleSuspected: boolean;
  skipped: boolean;
}

export interface Mark {
  t: number;
  label: string;
  strategy: ResetStrategy;
  emit: EmitMode;
  round: number;
  line: number;
}

export interface ViewportSample {
  t: number;
  reason: string;
  innerHeight: number;
  clientHeight: number;
  vvHeight: number | null;
  vvOffsetTop: number | null;
  vvScale: number | null;
}

export interface Trace {
  schema: 'twiper.trace/1';
  label: string;
  recordedAt: string;
  userAgent: string;
  standalone: boolean;
  results: LineResult[];
  marks: Mark[];
  viewport: ViewportSample[];
  events: LoggedEvent[];
  snapshots: LoggedSnapshot[];
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function traceLabel(): string {
  const ua = navigator.userAgent;
  const platform = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
  return `${platform}-${isStandalone() ? 'standalone' : 'browser'}`;
}

export function sampleViewport(reason: string): ViewportSample {
  const vv = window.visualViewport;
  return {
    t: performance.now(),
    reason,
    innerHeight: window.innerHeight,
    clientHeight: document.documentElement.clientHeight,
    vvHeight: vv ? Math.round(vv.height) : null,
    vvOffsetTop: vv ? Math.round(vv.offsetTop) : null,
    vvScale: vv ? vv.scale : null,
  };
}

/** 개발 서버의 /__trace로 보내 저장소 픽스처 폴더에 저장한다. 저장된 파일 이름을 돌려준다. */
export async function sendTrace(trace: Trace): Promise<string> {
  const response = await fetch('/__trace', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(trace),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { file?: string };
  return body.file ?? '';
}

export function downloadTrace(trace: Trace): void {
  const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `twiper-trace-${trace.label}-${trace.recordedAt.replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
