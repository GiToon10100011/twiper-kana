import { describe, expect, it } from 'vitest';
import {
  replayInputSession,
  toHiragana,
  type InputSnapshot,
  type JudgeMode,
} from '../../src/index';
import desktopEdgeCdp from '../fixtures/traces/desktop-edge-cdp.json';
import iosSafari18Kana from '../fixtures/traces/ios-safari-18-kana.json';
import iosStandalone18Kana from '../fixtures/traces/ios-standalone-18-kana.json';

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
  // iPhone(iOS 18.7) Safari 탭, 실제 かな 키보드. 리셋 전략 R1–R4를 각각 6줄씩 (2026-10-17)
  'ios-safari-18-kana': iosSafari18Kana,
  // 같은 기기, 홈 화면에 추가한 앱(standalone)으로 같은 순서를 반복 (2026-10-17)
  'ios-standalone-18-kana': iosStandalone18Kana,
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
      // 녹화 당시의 commit 판정은 조합 중 오타를 세지 않았다. 지금은 읽기로 세므로 composing 줄만 비교한다.
      if (result.judge === 'composing') expect(state.errors).toHaveLength(result.errors.length);
      expect(state.errors.filter((error) => error.cause === 'committed')).toEqual([]);
      expect(state.romajiSuspected).toBe(result.romajiSuspected);
      expect(state.toggleSuspected).toBe(result.toggleSuspected);
      expect(elapsedMs).toBe(result.elapsedMs);
    },
  );

  // 히라가나 목표는 읽기와 표기가 같으므로 commit 판정도 composing 판정과 똑같이 오타를 세야 한다.
  const commitKana = played.filter(
    (result) => result.judge === 'commit' && toHiragana(result.target) === result.target,
  );
  it
    .runIf(commitKana.length > 0)
    .each(commitKana.map((result) => [`#${result.session} ${result.target}`, result] as const))(
    '%s — commit 판정의 조합 중 오타가 composing 판정과 같다',
    (_title, result) => {
      const snapshots = trace.snapshots.filter(
        (snapshot) => snapshot.session === result.session && !snapshot.ignored,
      );
      const asCommit = replayInputSession(result.target, snapshots, 'commit');
      const asComposing = replayInputSession(result.target, snapshots, 'composing', {
        completeOnCommit: true,
      });

      expect(asCommit.errors).toEqual(asComposing.errors);
    },
  );
});
