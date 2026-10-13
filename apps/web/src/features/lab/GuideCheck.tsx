import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { iosKana } from '@twiper/content';
import { guideClaims, type FlickDirection, type InputStep } from '@twiper/core';
import {
  downloadLabData,
  isStandalone,
  readTraceKey,
  sendLabData,
  toCodePoint,
  traceLabel,
} from './trace';

type CheckStatus = 'typed' | 'unavailable';

interface CheckResult {
  id: string;
  expected: string;
  actual: string;
  expectedCodePoints: string[];
  actualCodePoints: string[];
  match: boolean;
  /** unavailable: 기기에 그 동작(키·방향)이 없음 */
  status: CheckStatus;
}

const GUIDE = iosKana;

const DIRECTION_LABEL: Record<FlickDirection, string> = {
  tap: '탭',
  left: '← 왼쪽으로 플릭',
  up: '↑ 위로 플릭',
  right: '→ 오른쪽으로 플릭',
  down: '↓ 아래로 플릭',
};

function describeStep(step: InputStep): string {
  if (step.kind === 'key') return `[${step.label}] 키 ${DIRECTION_LABEL[step.dir]}`;
  if (step.dir === 'tap') return `[${GUIDE.modifier.label}] 키 ${step.times}번 탭`;
  return `[${GUIDE.modifier.label}] 키 ${DIRECTION_LABEL[step.dir]}`;
}

/** prev 이후에 새로 생긴 부분. 앞부분이 바뀌었으면 달라진 지점부터 돌려준다. */
function addedSince(prev: string, next: string): string {
  const before = Array.from(prev);
  const after = Array.from(next);
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i += 1;
  return after.slice(i).join('');
}

/** 버튼을 눌러도 입력창의 포커스(키보드)를 유지한다. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

/**
 * 키보드 가이드 데이터가 실제 기기와 맞는지 확인하는 화면.
 * 안내된 동작을 실제 키보드로 수행하면 나온 문자를 기록해 가이드의 예상과 비교한다.
 * 입력창을 비우지 않고 이어 붙이면서, 항목마다 새로 늘어난 부분만 읽는다.
 */
export function GuideCheck() {
  const [onlyUnverified, setOnlyUnverified] = useState(true);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [baseline, setBaseline] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const claims = useMemo(
    () => guideClaims(GUIDE).filter((claim) => !onlyUnverified || claim.unverified),
    [onlyUnverified],
  );
  const claim = claims[index];
  const previous = index > 0 ? claims[index - 1] : undefined;
  const last = previous ? results[previous.id] : undefined;
  const recorded = claims.flatMap((item) => results[item.id] ?? []);
  const mismatches = recorded.filter((result) => !result.match);

  const record = (status: CheckStatus) => {
    if (!claim) return;
    const value = inputRef.current?.value ?? '';
    const actual = status === 'typed' ? addedSince(baseline, value) : '';
    setResults((prev) => ({
      ...prev,
      [claim.id]: {
        id: claim.id,
        expected: claim.expected,
        actual,
        expectedCodePoints: Array.from(claim.expected).map(toCodePoint),
        actualCodePoints: Array.from(actual).map(toCodePoint),
        match: status === 'typed' && actual === claim.expected,
        status,
      },
    }));
    setBaseline(value);
    setIndex((i) => i + 1);
  };

  const back = () => {
    setBaseline(inputRef.current?.value ?? '');
    setIndex((i) => Math.max(0, i - 1));
  };

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = '';
    setBaseline('');
  };

  const changeScope = (unverifiedOnly: boolean) => {
    setOnlyUnverified(unverifiedOnly);
    setBaseline(inputRef.current?.value ?? '');
    setIndex(0);
  };

  const buildPayload = () => ({
    schema: 'twiper.guide-check/1' as const,
    label: `guide-${GUIDE.id}-${traceLabel()}`,
    recordedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    standalone: isStandalone(),
    guideId: GUIDE.id,
    results: recorded,
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
      setMessage(`저장됨: ${await sendLabData(buildPayload(), key)}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '알 수 없는 오류';
      setMessage(`전송 실패 (${reason}). 다운로드를 사용하세요.`);
    }
  };

  const layerChanged = claim !== undefined && previous?.layer !== claim.layer;

  return (
    <main className="lab">
      <header className="lab-header">
        <Link to="/">←</Link>
        <strong>키보드 가이드 확인</strong>
        <span>
          {Math.min(index + 1, claims.length)}/{claims.length} · 불일치 {mismatches.length}
        </span>
      </header>

      {claim ? (
        <>
          <p className="lab-status">
            {GUIDE.layers[claim.layer].switchLabel} 모드
            {layerChanged ? ' — 키보드를 이 모드로 바꾸세요' : ''}
          </p>
          <p className="lab-instruction">{claim.steps.map(describeStep).join(' → ')}</p>
          <p className="lab-target" lang="ja" aria-label="예상 출력">
            {claim.expected}
          </p>
        </>
      ) : (
        <p className="lab-instruction">모든 항목을 기록했습니다. 결과를 보내 주세요.</p>
      )}

      <div className="lab-inputs">
        <input
          ref={inputRef}
          className="lab-input"
          type="text"
          lang="ja"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="입력창"
          placeholder="안내된 동작만 입력"
        />
      </div>

      <p className="lab-status">
        {last
          ? `직전: 예상 ${last.expected} (${last.expectedCodePoints.join(' ')}) / 실제 ${
              last.status === 'unavailable'
                ? '동작 없음'
                : `${last.actual || '입력 없음'} (${last.actualCodePoints.join(' ') || '-'})`
            } ${last.match ? '✓' : '✗'}`
          : '안내된 동작을 한 뒤 "기록"을 누르세요. 입력창은 비우지 않아도 됩니다.'}
      </p>

      <div className="lab-row">
        <button type="button" onMouseDown={keepFocus} onClick={() => inputRef.current?.focus()}>
          입력 시작
        </button>
        <button
          type="button"
          disabled={!claim}
          onMouseDown={keepFocus}
          onClick={() => record('typed')}
        >
          기록 → 다음
        </button>
        <button
          type="button"
          disabled={!claim}
          onMouseDown={keepFocus}
          onClick={() => record('unavailable')}
        >
          이 동작 없음
        </button>
        <button type="button" disabled={index === 0} onMouseDown={keepFocus} onClick={back}>
          이전
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={clearInput}>
          입력창 비우기
        </button>
      </div>

      <fieldset>
        <legend>확인 범위</legend>
        <label>
          <input
            type="radio"
            name="scope"
            checked={onlyUnverified}
            onChange={() => changeScope(true)}
          />{' '}
          확인이 필요한 항목만 <small>문헌으로 확정하지 못한 동작</small>
        </label>
        <label>
          <input
            type="radio"
            name="scope"
            checked={!onlyUnverified}
            onChange={() => changeScope(false)}
          />{' '}
          전체 <small>기본 50음 포함</small>
        </label>
      </fieldset>

      <div className="lab-row">
        <button type="button" onClick={() => void send()}>
          서버로 보내기
        </button>
        <button type="button" onClick={() => downloadLabData(buildPayload())}>
          JSON 다운로드
        </button>
      </div>
      <p className="lab-status" role="status">
        {message}
      </p>

      <h2>
        불일치 {mismatches.length}건 / 기록 {recorded.length}건
      </h2>
      <table>
        <thead>
          <tr>
            <th>항목</th>
            <th>예상</th>
            <th>실제</th>
          </tr>
        </thead>
        <tbody>
          {mismatches.map((result) => (
            <tr key={result.id}>
              <td>{result.id}</td>
              <td lang="ja">
                {result.expected} <small>{result.expectedCodePoints.join(' ')}</small>
              </td>
              <td lang="ja">
                {result.status === 'unavailable' ? '동작 없음' : result.actual || '입력 없음'}{' '}
                <small>{result.actualCodePoints.join(' ')}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
