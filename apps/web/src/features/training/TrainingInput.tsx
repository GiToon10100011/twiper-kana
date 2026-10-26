import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  createInputSession,
  HELP_POLICY,
  pendingStep,
  reduceInputSession,
  type InputSessionState,
  type JudgeMode,
} from '@twiper/core';
import { attachImeAdapter } from '../../platform/input/imeAdapter';
import { Furigana } from './Furigana';
import { TargetText } from './TargetText';

interface TrainingInputProps {
  target: string;
  /** 같은 목표를 다시 낼 때도 새 문제로 보려면 바꾼다. 기본값은 목표 문자열 */
  questionKey?: string;
  judge?: JudgeMode;
  /** 確定 후 정답이면 호출한다. 이때 입력창은 이미 비어 있다 */
  onComplete: (session: InputSessionState) => void;
  /** 값이 목표와 같아졌을 때 보여 줄 안내 (確定을 누르라는 말) */
  matchedHint: string;
  /** commit 판정에서 읽기를 다 쳤을 때 보여 줄 안내 (후보에서 고르라는 말) */
  convertHint?: string;
  /** commit 판정에서 목표와 다르게 確定했을 때 보여 줄 안내 (지우고 다시 치라는 말) */
  fixHint?: string;
  /** 세션 상태에 따라 보여 줄 경고(로마자 키보드 등). 없으면 null */
  notice?: (session: InputSessionState) => string | null;
  /**
   * 입력창 아래에 띄울 상황별 도움말. stuckAt은 진행 없이 idleMs가 지난 목표 글자 위치(없으면 null).
   * 없으면 머뭇거림을 재지 않는다
   */
  help?: (session: InputSessionState, stuckAt: number | null) => ReactNode;
  /** 머뭇거림으로 볼 시간 (ms, 설정). 0이면 재지 않는다. 기본값은 HELP_POLICY.idleMs */
  idleMs?: number;
  /** 이 글자 위치 뒤에 틈을 두어 어절을 나눠 보인다 (종합 테스트의 문장) */
  gapsAfter?: readonly number[];
  /**
   * sentence: 문장이 길어 글자를 줄이고 왼쪽부터 채운다 /
   * chat: 상대 말풍선(왼쪽) 아래 내 말풍선(오른쪽) 안에 목표를 둔다 (2026-10-26 시안 A 채택)
   */
  layout?: 'sentence' | 'chat';
  /** chat에서 상대 말. 한자 표기 그대로 주면 후리가나를 붙여 보인다 */
  partner?: string;
  /** 한자를 읽기(가나)대로 쳐도 맞다 (설정 「한자는 바꿔야 정답」을 끈 경우) */
  readingOk?: boolean;
  /** 목표 바로 아래에 둘 것 (긴 글의 다음 줄 미리보기) */
  afterTarget?: ReactNode;
  /** 입력 세션이 바뀔 때마다 알린다 (종합 테스트의 시간 재기) */
  onProgress?: (session: InputSessionState) => void;
  placeholder?: string;
  targetLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const newSession = (target: string, judge: JudgeMode, readingOk: boolean) =>
  createInputSession(target, judge, { completeOnCommit: true, readingOk });

/**
 * 실제 시스템 키보드로 목표 문자열을 입력하는 입력창.
 * 다음 문제로는 確定 후에만 넘어가고(결정 0001), 목표가 바뀌어도 같은 <input>을 유지해 키보드가 끊기지 않게 한다.
 */
export function TrainingInput({
  target,
  questionKey = target,
  judge = 'composing',
  onComplete,
  matchedHint,
  convertHint,
  fixHint,
  notice,
  help,
  idleMs = HELP_POLICY.idleMs,
  gapsAfter,
  layout,
  partner,
  readingOk = false,
  afterTarget,
  onProgress,
  placeholder,
  targetLabel,
  inputRef,
}: TrainingInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const [session, setSession] = useState(() => newSession(target, judge, readingOk));
  const [stuckAt, setStuckAt] = useState<number | null>(null);
  const [currentKey, setCurrentKey] = useState(questionKey);
  if (currentKey !== questionKey) {
    setCurrentKey(questionKey);
    setSession(newSession(target, judge, readingOk));
    setStuckAt(null);
  }
  // 막혔던 글자를 맞게 치고 지나가면 잊는다. 지워서 되돌아와도 다시 머뭇거려야 도움말을 띄운다.
  // 그 글자를 치는 중(き를 치고 小゛゜를 누르기 전)에는 지나간 것이 아니므로 남겨 둔다.
  if (stuckAt !== null && session.matched > stuckAt) setStuckAt(null);

  // 스냅샷이 올 때마다 다시 잰다. 한동안 아무 입력이 없으면 그때 칠 차례였던 글자에서 막힌 것으로 본다.
  const measuresIdle = help !== undefined && idleMs > 0;
  useEffect(() => {
    if (!measuresIdle || session.completedAt !== null) return;
    const index = session.matched;
    const timer = window.setTimeout(() => setStuckAt(index), idleMs);
    return () => window.clearTimeout(timer);
  }, [session, measuresIdle, idleMs]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  });
  useEffect(() => {
    onProgressRef.current?.(session);
  }, [session]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachImeAdapter(el, {
      emit: 'task',
      onSnapshot: (snapshot) => setSession((prev) => reduceInputSession(prev, snapshot)),
    });
  }, [ref]);

  const reported = useRef<InputSessionState | null>(null);
  useEffect(() => {
    if (session.completedAt === null || reported.current === session) return;
    reported.current = session;
    // 確定으로 조합이 끝난 뒤라 값을 비워도 입력이 끊기지 않는다.
    if (ref.current) ref.current.value = '';
    onCompleteRef.current(session);
  }, [session, ref]);

  const step = pendingStep(session);
  const stepHint = { commit: matchedHint, convert: convertHint, fix: fixHint };
  const warning = notice?.(session) ?? (step === 'fix' ? (fixHint ?? null) : null);
  const hint = warning ?? (step ? (stepHint[step] ?? '') : '');
  const hintClass = warning ? ' is-warning' : step ? ' is-matched' : '';
  const targetText = <TargetText session={session} label={targetLabel} gapsAfter={gapsAfter} />;

  return (
    <div className={`trainer${layout ? ` is-${layout}` : ''}`}>
      {layout === 'chat' ? (
        <>
          {partner ? (
            <p className="chat-bubble is-partner" lang="ja">
              <Furigana text={partner} />
            </p>
          ) : null}
          <div className="chat-bubble is-me">{targetText}</div>
        </>
      ) : (
        targetText
      )}
      {afterTarget}
      <input
        ref={ref}
        className="text-input"
        type="text"
        lang="ja"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={targetLabel}
      />
      <p className={`trainer-hint${hintClass}`} role="status">
        {hint}
      </p>
      {help?.(session, stuckAt)}
    </div>
  );
}
