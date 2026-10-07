import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import {
  charStatuses,
  createInputSession,
  reduceInputSession,
  type InputSessionState,
  type InputSnapshot,
  type JudgeMode,
} from '@twiper/core';
import {
  attachImeAdapter,
  type EmitMode,
  type RawInputEvent,
} from '../../platform/input/imeAdapter';
import {
  downloadTrace,
  isStandalone,
  readTraceKey,
  sampleViewport,
  sendTrace,
  traceLabel,
  type InputSource,
  type LineResult,
  type LoggedEvent,
  type LoggedSnapshot,
  type Mark,
  type ResetStrategy,
  type Trace,
  type ViewportSample,
} from './trace';

interface LabLine {
  target: string;
  judge: JudgeMode;
}

const FIRST_LINE: LabLine = { target: 'あいうえお', judge: 'composing' };

const LINES: readonly LabLine[] = [
  FIRST_LINE,
  { target: 'かきくけこ', judge: 'composing' },
  { target: 'がぎぐげご', judge: 'composing' },
  { target: 'きゃきゅきょ', judge: 'composing' },
  { target: 'カメラ', judge: 'commit' },
  { target: 'ー、。？！', judge: 'composing' },
];

const STRATEGIES: readonly { id: ResetStrategy; label: string; hint: string }[] = [
  {
    id: 'swap',
    label: 'R1 입력창 교대',
    hint: '다른 입력창으로 포커스를 옮기고 이전 입력창을 비움',
  },
  { id: 'assign', label: 'R2 값 직접 비움', hint: "조합 중에 value = ''" },
  {
    id: 'blurFocus',
    label: 'R3 blur → 비움 → focus',
    hint: '같은 입력창에서 포커스를 뗐다 다시 줌',
  },
  { id: 'commitOnly', label: 'R4 確定 후 비움', hint: '조합이 끝난 뒤에만 판정하고 비움' },
];

const EMIT_MODES: readonly { id: EmitMode; label: string; hint: string }[] = [
  { id: 'task', label: 'task', hint: '이벤트를 모아 setTimeout(0)에서 판정' },
  { id: 'sync', label: 'sync', hint: 'input 이벤트 핸들러 안에서 즉시 판정' },
];

const MARKS: readonly { id: string; label: string }[] = [
  { id: 'ok', label: '정상' },
  { id: 'keyboard-closed', label: '키보드 닫힘' },
  { id: 'text-revived', label: '이전 글자 되살아남' },
  { id: 'other', label: '기타 이상' },
];

const MAX_LOG = 5000;

interface LabState {
  strategy: ResetStrategy;
  emit: EmitMode;
  active: InputSource;
  round: number;
  line: number;
  session: InputSessionState;
  /** 현재 입력 세션의 번호. trace에서 스냅샷과 결과를 짝짓는 데 쓴다 */
  sessionSeq: number;
  /** 입력창을 비우는 동안 발생한 스냅샷을 세션에 넣지 않기 위한 표시 */
  resetting: boolean;
  events: LoggedEvent[];
  snapshots: LoggedSnapshot[];
  results: LineResult[];
  marks: Mark[];
  viewport: ViewportSample[];
}

const lineAt = (index: number): LabLine => LINES[index] ?? FIRST_LINE;

/** R4는 가나만으로 된 줄도 確定을 기다린다. */
const judgeFor = (strategy: ResetStrategy, line: LabLine): JudgeMode =>
  strategy === 'commitOnly' ? 'commit' : line.judge;

function createLabState(): LabState {
  const strategy: ResetStrategy = 'swap';
  return {
    strategy,
    emit: 'task',
    active: 'A',
    round: 1,
    line: 0,
    session: createInputSession(FIRST_LINE.target, judgeFor(strategy, FIRST_LINE)),
    sessionSeq: 1,
    resetting: false,
    events: [],
    snapshots: [],
    results: [],
    marks: [],
    viewport: [],
  };
}

function pushCapped<T>(list: T[], item: T): void {
  list.push(item);
  if (list.length > MAX_LOG) list.shift();
}

function formatEvent(event: LoggedEvent): string {
  const parts = [event.t.toFixed(0).padStart(7), event.src, event.type];
  if (event.inputType) parts.push(event.inputType);
  if (event.data !== null) parts.push(`data=${JSON.stringify(event.data)}`);
  if (event.isComposing !== null) parts.push(`composing=${event.isComposing}`);
  if (event.keyCode !== null) parts.push(`key=${event.key}(${event.keyCode})`);
  parts.push(`value=${JSON.stringify(event.value)}`);
  return parts.join(' ');
}

const toCodePoint = (char: string): string =>
  `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;

/** 버튼을 눌러도 입력창의 포커스(키보드)를 유지한다. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

/**
 * M0 스파이크: 실제 시스템 키보드로 문제를 끊김 없이 연속해서 풀 수 있는지 확인하는 진단 화면.
 * 훈련 화면이 아니며, 실기기에서 이벤트 trace를 모으는 용도다.
 */
export function ImeLab() {
  const [lab] = useState(createLabState);
  const [, setTick] = useState(0);
  const [message, setMessage] = useState('');
  const inputA = useRef<HTMLInputElement>(null);
  const inputB = useRef<HTMLInputElement>(null);

  const rerender = useCallback(() => setTick((tick) => tick + 1), []);
  const elementOf = useCallback(
    (src: InputSource) => (src === 'A' ? inputA.current : inputB.current),
    [],
  );

  const startLine = useCallback(() => {
    const line = lineAt(lab.line);
    lab.session = createInputSession(line.target, judgeFor(lab.strategy, line));
    lab.sessionSeq += 1;
  }, [lab]);

  const resetInputs = useCallback(
    (wasComposing: boolean) => {
      const current = elementOf(lab.active);
      if (!current) return;
      lab.resetting = true;
      try {
        if (wasComposing && lab.strategy === 'swap') {
          const nextSource: InputSource = lab.active === 'A' ? 'B' : 'A';
          const other = elementOf(nextSource);
          if (other) {
            other.value = '';
            other.focus();
            lab.active = nextSource;
          }
          current.value = '';
        } else if (wasComposing && lab.strategy === 'blurFocus') {
          current.blur();
          current.value = '';
          current.focus();
        } else {
          // R2, 또는 조합이 이미 끝난 경우: 값만 비운다.
          current.value = '';
        }
      } finally {
        lab.resetting = false;
      }
    },
    [lab, elementOf],
  );

  const completeLine = useCallback(
    (skipped: boolean, wasComposing: boolean) => {
      const line = lineAt(lab.line);
      const { session } = lab;
      lab.results.push({
        session: lab.sessionSeq,
        round: lab.round,
        line: lab.line,
        target: line.target,
        judge: session.judge,
        strategy: lab.strategy,
        emit: lab.emit,
        elapsedMs:
          session.startedAt !== null && session.completedAt !== null
            ? Math.round(session.completedAt - session.startedAt)
            : null,
        errors: [...session.errors],
        romajiSuspected: session.romajiSuspected,
        toggleSuspected: session.toggleSuspected,
        skipped,
      });
      if (lab.line + 1 >= LINES.length) {
        lab.line = 0;
        lab.round += 1;
      } else {
        lab.line += 1;
      }
      resetInputs(wasComposing);
      startLine();
    },
    [lab, resetInputs, startLine],
  );

  const handleSnapshot = useCallback(
    (src: InputSource, snapshot: InputSnapshot) => {
      const ignored = lab.resetting || src !== lab.active;
      pushCapped(lab.snapshots, {
        ...snapshot,
        src,
        session: lab.sessionSeq,
        line: lab.line,
        ignored,
      });
      if (ignored) return;
      lab.session = reduceInputSession(lab.session, snapshot);
      if (lab.session.completedAt !== null) completeLine(false, snapshot.composing);
      rerender();
    },
    [lab, completeLine, rerender],
  );

  const handleRawEvent = useCallback(
    (src: InputSource, event: RawInputEvent) => {
      pushCapped(lab.events, { ...event, src });
      if (event.type === 'focus' || event.type === 'blur') {
        pushCapped(lab.viewport, sampleViewport(`${event.type}:${src}`));
      }
      rerender();
    },
    [lab, rerender],
  );

  const emit = lab.emit;
  useEffect(() => {
    const detach: (() => void)[] = [];
    for (const src of ['A', 'B'] as const) {
      const el = elementOf(src);
      if (!el) continue;
      detach.push(
        attachImeAdapter(el, {
          emit,
          onSnapshot: (snapshot) => handleSnapshot(src, snapshot),
          onRawEvent: (event) => handleRawEvent(src, event),
        }),
      );
    }
    return () => detach.forEach((fn) => fn());
  }, [emit, elementOf, handleSnapshot, handleRawEvent]);

  useEffect(() => {
    const record = (reason: string) => {
      pushCapped(lab.viewport, sampleViewport(reason));
      rerender();
    };
    const onViewportResize = () => record('vv-resize');
    const onViewportScroll = () => record('vv-scroll');
    const onWindowResize = () => record('window-resize');
    // 주소의 #k=… 를 화면 이동 전에 읽어 둔다.
    readTraceKey();
    record('mount');
    window.visualViewport?.addEventListener('resize', onViewportResize);
    window.visualViewport?.addEventListener('scroll', onViewportScroll);
    window.addEventListener('resize', onWindowResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      window.visualViewport?.removeEventListener('scroll', onViewportScroll);
      window.removeEventListener('resize', onWindowResize);
    };
  }, [lab, rerender]);

  const restartLine = () => {
    const el = elementOf(lab.active);
    if (el) el.value = '';
    startLine();
    rerender();
  };

  const chooseStrategy = (strategy: ResetStrategy) => {
    lab.strategy = strategy;
    restartLine();
  };

  const chooseEmit = (mode: EmitMode) => {
    lab.emit = mode;
    rerender();
  };

  const skipLine = () => {
    completeLine(true, lab.session.composing);
    rerender();
  };

  const addMark = (label: string) => {
    lab.marks.push({
      t: performance.now(),
      label,
      strategy: lab.strategy,
      emit: lab.emit,
      round: lab.round,
      line: lab.line,
    });
    rerender();
  };

  const clearLogs = () => {
    lab.events = [];
    lab.snapshots = [];
    lab.results = [];
    lab.marks = [];
    lab.viewport = [sampleViewport('clear')];
    lab.round = 1;
    lab.line = 0;
    setMessage('');
    restartLine();
  };

  const buildTrace = (): Trace => ({
    schema: 'twiper.trace/1',
    label: traceLabel(),
    recordedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    standalone: isStandalone(),
    results: lab.results,
    marks: lab.marks,
    viewport: lab.viewport,
    events: lab.events,
    snapshots: lab.snapshots,
  });

  const send = async () => {
    const key = readTraceKey();
    if (!key) {
      setMessage(
        'trace 키가 없습니다. pnpm dev:lan이 출력한 주소(#k=…)로 접속하거나 다운로드하세요.',
      );
      return;
    }
    setMessage('보내는 중…');
    try {
      const file = await sendTrace(buildTrace(), key);
      setMessage(`저장됨: ${file}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '알 수 없는 오류';
      setMessage(`전송 실패 (${reason}). 다운로드를 사용하세요.`);
    }
  };

  const { session } = lab;
  const statuses = charStatuses(session);
  const viewport = lab.viewport[lab.viewport.length - 1];
  const recentEvents = lab.events.slice(-60).reverse();
  const recentResults = lab.results.slice(-12).reverse();

  return (
    <main className="lab">
      <header className="lab-header">
        <Link to="/">←</Link>
        <strong>IME 스파이크</strong>
        <span>
          {lab.round}회차 · {lab.line + 1}/{LINES.length} · {session.judge}
        </span>
      </header>

      <p className="lab-target" lang="ja" aria-label="목표">
        {session.target.map((char, i) => (
          <span key={i} className={`ch-${statuses[i] ?? 'todo'}`}>
            {char}
          </span>
        ))}
      </p>

      <div className="lab-inputs">
        {(['A', 'B'] as const).map((src) => (
          <input
            key={src}
            ref={src === 'A' ? inputA : inputB}
            className={src === lab.active ? 'lab-input' : 'lab-input lab-input-idle'}
            type="text"
            lang="ja"
            inputMode="text"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            tabIndex={src === lab.active ? 0 : -1}
            aria-label={`입력창 ${src}`}
            placeholder="かな 키보드로 입력"
          />
        ))}
      </div>

      <p className="lab-status">
        입력창 {lab.active} · {session.composing ? '조합 중' : '확정'} · 오류{' '}
        {session.errors.length}
        {session.romajiSuspected ? ' · 로마자 키보드 의심' : ''}
        {session.toggleSuspected ? ' · 토글 입력 의심' : ''}
        <br />
        {session.value.map(toCodePoint).join(' ')}
      </p>

      <div className="lab-row">
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => elementOf(lab.active)?.focus()}
        >
          입력 시작
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={skipLine}>
          건너뛰기
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={restartLine}>
          이 줄 다시
        </button>
      </div>

      <div className="lab-row" aria-label="관찰 표시">
        {MARKS.map((mark) => (
          <button
            key={mark.id}
            type="button"
            onMouseDown={keepFocus}
            onClick={() => addMark(mark.id)}
          >
            {mark.label}
          </button>
        ))}
        <small>표시 {lab.marks.length}건</small>
      </div>

      <fieldset>
        <legend>리셋 전략</legend>
        {STRATEGIES.map((strategy) => (
          <label key={strategy.id}>
            <input
              type="radio"
              name="strategy"
              checked={lab.strategy === strategy.id}
              onChange={() => chooseStrategy(strategy.id)}
            />{' '}
            {strategy.label} <small>{strategy.hint}</small>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>스냅샷 타이밍</legend>
        {EMIT_MODES.map((mode) => (
          <label key={mode.id}>
            <input
              type="radio"
              name="emit"
              checked={lab.emit === mode.id}
              onChange={() => chooseEmit(mode.id)}
            />{' '}
            {mode.label} <small>{mode.hint}</small>
          </label>
        ))}
      </fieldset>

      <div className="lab-row">
        <button type="button" onClick={() => void send()}>
          서버로 보내기
        </button>
        <button type="button" onClick={() => downloadTrace(buildTrace())}>
          JSON 다운로드
        </button>
        <button type="button" onClick={clearLogs}>
          기록 지우기
        </button>
      </div>
      <p className="lab-status" role="status">
        {message}
      </p>

      <h2>결과 (최근 {recentResults.length}줄)</h2>
      <table>
        <thead>
          <tr>
            <th>줄</th>
            <th>목표</th>
            <th>전략 / 타이밍</th>
            <th>시간</th>
            <th>오류</th>
          </tr>
        </thead>
        <tbody>
          {recentResults.map((result, i) => (
            <tr key={`${result.round}-${result.line}-${i}`}>
              <td>
                {result.round}-{result.line + 1}
              </td>
              <td lang="ja">{result.target}</td>
              <td>
                {result.strategy} / {result.emit}
              </td>
              <td>{result.skipped ? '건너뜀' : `${result.elapsedMs ?? '-'}ms`}</td>
              <td>
                {result.errors.length}
                {result.romajiSuspected ? ' R' : ''}
                {result.toggleSuspected ? ' T' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>뷰포트</h2>
      <p className="lab-status">
        innerHeight {viewport?.innerHeight ?? '-'} · visualViewport {viewport?.vvHeight ?? '-'} (top{' '}
        {viewport?.vvOffsetTop ?? '-'}) · clientHeight {viewport?.clientHeight ?? '-'} ·{' '}
        {isStandalone() ? '홈 화면 앱' : '브라우저 탭'}
      </p>

      <h2>
        이벤트 (최근 {recentEvents.length} / 전체 {lab.events.length})
      </h2>
      <pre className="lab-log">{recentEvents.map(formatEvent).join('\n')}</pre>
    </main>
  );
}
