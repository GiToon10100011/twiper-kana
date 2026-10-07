import type { InputSnapshot } from '@twiper/core';

/**
 * task: 한 태스크 안에서 발생한 이벤트를 모아 스냅샷 1건으로 내보낸다.
 * sync: input·compositionend 핸들러 안에서 즉시 내보낸다.
 */
export type EmitMode = 'task' | 'sync';

export interface RawInputEvent {
  t: number;
  type: string;
  data: string | null;
  inputType: string | null;
  isComposing: boolean | null;
  key: string | null;
  keyCode: number | null;
  /** 이벤트 시점의 입력창 값 */
  value: string;
}

export interface ImeAdapterOptions {
  emit: EmitMode;
  onSnapshot: (snapshot: InputSnapshot) => void;
  onRawEvent?: (event: RawInputEvent) => void;
}

const LISTENED = [
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'beforeinput',
  'input',
  'keydown',
  'keyup',
  'focus',
  'blur',
] as const;

/** 값이 이미 반영된 뒤에 발생하는 이벤트 */
const VALUE_SETTLED = new Set<string>(['input', 'compositionend', 'blur']);
/** 값을 바꾸지 않아 스냅샷이 필요 없는 이벤트 */
const NO_VALUE_CHANGE = new Set<string>(['beforeinput', 'keydown', 'keyup', 'focus']);

function describe(event: Event, el: HTMLInputElement, t: number): RawInputEvent {
  const composition = event instanceof CompositionEvent ? event : null;
  const input = event instanceof InputEvent ? event : null;
  const keyboard = event instanceof KeyboardEvent ? event : null;
  return {
    t,
    type: event.type,
    data: composition?.data ?? input?.data ?? null,
    inputType: input?.inputType ?? null,
    isComposing: input?.isComposing ?? keyboard?.isComposing ?? null,
    key: keyboard?.key ?? null,
    // Android 소프트 키보드는 조합 중 keyCode 229만 보내므로 기록해 둔다.
    keyCode: keyboard?.keyCode ?? null,
    value: el.value,
  };
}

/**
 * 입력창의 composition/input 이벤트를 InputSnapshot 열로 바꾼다.
 * 브라우저마다 이벤트 순서가 달라서 순서에 기대지 않고, 이벤트 뒤의 (값, 조합 여부)만 내보낸다.
 */
export function attachImeAdapter(el: HTMLInputElement, options: ImeAdapterOptions): () => void {
  let composing = false;
  let lastValue: string | null = null;
  let lastComposing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingT = 0;

  const emit = (t: number) => {
    const value = el.value;
    if (value === lastValue && composing === lastComposing) return;
    lastValue = value;
    lastComposing = composing;
    options.onSnapshot({ t, value, composing });
  };

  const handle = (event: Event) => {
    const t = performance.now();
    if (event.type === 'compositionstart' || event.type === 'compositionupdate') composing = true;
    else if (event.type === 'compositionend' || event.type === 'blur') composing = false;

    options.onRawEvent?.(describe(event, el, t));

    if (options.emit === 'sync') {
      if (VALUE_SETTLED.has(event.type)) emit(t);
      return;
    }
    if (NO_VALUE_CHANGE.has(event.type)) return;
    pendingT = t;
    timer ??= setTimeout(() => {
      timer = null;
      emit(pendingT);
    }, 0);
  };

  for (const type of LISTENED) el.addEventListener(type, handle);
  return () => {
    for (const type of LISTENED) el.removeEventListener(type, handle);
    if (timer !== null) clearTimeout(timer);
  };
}
