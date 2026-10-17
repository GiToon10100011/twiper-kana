import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  createInputSession,
  reduceInputSession,
  type InputSessionState,
  type JudgeMode,
} from '@twiper/core';
import { attachImeAdapter } from '../../platform/input/imeAdapter';
import { TargetText } from './TargetText';

interface TrainingInputProps {
  target: string;
  /** 같은 목표를 다시 낼 때도 새 문제로 보려면 바꾼다. 기본값은 목표 문자열 */
  questionKey?: string;
  judge?: JudgeMode;
  /** 確定 후 정답이면 호출한다. 이때 입력창은 이미 비어 있다 */
  onComplete: (session: InputSessionState) => void;
  /** 조합 중 일치했을 때 보여 줄 안내 (確定을 누르라는 말) */
  matchedHint: string;
  /** 세션 상태에 따라 보여 줄 경고(로마자 키보드 등). 없으면 null */
  notice?: (session: InputSessionState) => string | null;
  placeholder?: string;
  targetLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const newSession = (target: string, judge: JudgeMode) =>
  createInputSession(target, judge, { completeOnCommit: true });

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
  notice,
  placeholder,
  targetLabel,
  inputRef,
}: TrainingInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const [session, setSession] = useState(() => newSession(target, judge));
  const [currentKey, setCurrentKey] = useState(questionKey);
  if (currentKey !== questionKey) {
    setCurrentKey(questionKey);
    setSession(newSession(target, judge));
  }

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

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

  const waitingForCommit = session.matchedAt !== null && session.completedAt === null;
  const warning = notice?.(session) ?? null;
  const hintClass = warning ? ' is-warning' : waitingForCommit ? ' is-matched' : '';

  return (
    <div className="trainer">
      <TargetText session={session} label={targetLabel} />
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
        {warning ?? (waitingForCommit ? matchedHint : '')}
      </p>
    </div>
  );
}
