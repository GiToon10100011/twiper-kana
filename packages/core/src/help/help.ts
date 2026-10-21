import { pendingStep } from '../input/session';
import type { InputError, InputSessionState } from '../input/types';

/** 상황별 도움말을 띄우는 기준 (계획 §6 Contextual Help) */
export interface HelpPolicy {
  /** 다음 글자에서 이만큼(ms) 진행이 없으면 띄운다 */
  readonly idleMs: number;
  /** 이번 판에서 같은 글자를 이만큼 틀렸으면 그 글자에 올 때마다 띄운다 */
  readonly repeatMisses: number;
}

export const HELP_POLICY: HelpPolicy = { idleMs: 2500, repeatMisses: 2 };

/**
 * 목표 글자마다 틀린 횟수. 이번 판에 끝낸 줄과 지금 줄의 오류를 모두 넘긴다.
 * 한 자리에서 두 번 틀렸으면 두 번으로 센다. 목표를 넘어선 초과 입력(expected '')은 뺀다.
 */
export function missCounts(errors: readonly Pick<InputError, 'expected'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { expected } of errors) {
    if (expected === '') continue;
    counts.set(expected, (counts.get(expected) ?? 0) + 1);
  }
  return counts;
}

/**
 * 도움 카드를 띄울 목표 글자의 위치. 없으면 null.
 * 맞게 친 데까지의 다음 글자를 본다: 거기서 머뭇거렸거나(stuckAt) 이번 판에서 여러 번 틀린 글자면 띄운다.
 * 確定·변환·고치기를 기다릴 때는 입력창 아래 안내가 이미 있으므로 띄우지 않는다.
 */
export function helpIndex(
  session: InputSessionState,
  { stuckAt, misses }: { stuckAt: number | null; misses: ReadonlyMap<string, number> },
  policy: HelpPolicy = HELP_POLICY,
): number | null {
  if (session.completedAt !== null || pendingStep(session) !== null) return null;
  const index = session.matched;
  const char = session.target[index];
  if (char === undefined) return null;
  if (stuckAt === index) return index;
  return (misses.get(char) ?? 0) >= policy.repeatMisses ? index : null;
}
