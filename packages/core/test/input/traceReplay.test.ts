import { describe, expect, it } from 'vitest';
import { replayInputSession, type InputSnapshot, type JudgeMode } from '../../src/index';
import desktopEdgeCdp from '../fixtures/traces/desktop-edge-cdp.json';

/** /lab/ime가 내보내는 trace 중 재생에 필요한 부분 */
interface RecordedTrace {
  results: {
    session: number;
    target: string;
    judge: string;
    errors: unknown[];
    elapsedMs: number | null;
    romajiSuspected: boolean;
    toggleSuspected: boolean;
    skipped: boolean;
  }[];
  snapshots: (InputSnapshot & { session: number; ignored: boolean })[];
}

// 실기기에서 녹화한 trace는 fixtures/traces/incoming/에서 검토한 뒤 이름을 붙여 여기에 추가한다.
const TRACES: Record<string, RecordedTrace> = {
  // 데스크톱 Edge(Chromium)에서 CDP Input.imeSetComposition으로 조합을 흉내 낸 합성 trace
  'desktop-edge-cdp': desktopEdgeCdp,
};

describe.each(Object.entries(TRACES))('trace 재생: %s', (_name, trace) => {
  const played = trace.results.filter((result) => !result.skipped);

  it('완료된 줄이 하나 이상 녹화돼 있다', () => {
    expect(played.length).toBeGreaterThan(0);
  });

  it.each(played.map((result) => [`#${result.session} ${result.target}`, result] as const))(
    '%s — 녹화 당시와 같은 판정이 나온다',
    (_title, result) => {
      const snapshots = trace.snapshots.filter(
        (snapshot) => snapshot.session === result.session && !snapshot.ignored,
      );
      const state = replayInputSession(result.target, snapshots, result.judge as JudgeMode);
      const elapsedMs =
        state.startedAt === null || state.completedAt === null
          ? null
          : Math.round(state.completedAt - state.startedAt);

      expect(state.completedAt).not.toBeNull();
      expect(state.errors).toHaveLength(result.errors.length);
      expect(state.romajiSuspected).toBe(result.romajiSuspected);
      expect(state.toggleSuspected).toBe(result.toggleSuspected);
      expect(elapsedMs).toBe(result.elapsedMs);
    },
  );
});
