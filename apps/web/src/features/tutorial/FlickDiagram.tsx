import { useEffect, useState, type CSSProperties } from 'react';
import type { FlickDirection, GuideKey } from '@twiper/core';

const ORDER: readonly FlickDirection[] = ['tap', 'left', 'up', 'right', 'down'];
const OFFSET: Record<FlickDirection, readonly [number, number]> = {
  tap: [0, 0],
  left: [-1, 0],
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
};
const AREA: Record<FlickDirection, string> = {
  tap: 'center',
  left: 'left',
  up: 'up',
  right: 'right',
  down: 'down',
};
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const STEP_MS = 1200;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(REDUCED_MOTION).matches === true,
  );
  useEffect(() => {
    const media = window.matchMedia?.(REDUCED_MOTION);
    if (!media) return;
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

interface FlickDiagramProps {
  keyDef: GuideKey;
  labels: Record<FlickDirection, string>;
  /** 강조할 방향. 지정하지 않으면 탭 → ← → ↑ → → → ↓를 차례로 보여 준다 */
  active?: FlickDirection;
}

/**
 * 키 하나의 탭·4방향 글자를 보여 주고, 손가락 표시가 각 방향으로 움직인다.
 * 설명용 도해이며 입력은 받지 않는다.
 */
export function FlickDiagram({ keyDef, labels, active }: FlickDiagramProps) {
  const reduced = usePrefersReducedMotion();
  const animate = active === undefined && !reduced;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % ORDER.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [animate]);

  const current = active ?? (animate ? (ORDER[step] ?? 'tap') : null);
  const [dx, dy] = current ? OFFSET[current] : OFFSET.tap;
  const summary = ORDER.flatMap((dir) => {
    const char = keyDef.outputs[dir];
    return char ? [`${labels[dir]} ${char}`] : [];
  }).join(', ');

  return (
    <div className="flick" role="img" aria-label={summary}>
      {ORDER.map((dir) => {
        const char = keyDef.outputs[dir];
        if (char === undefined) return null;
        return (
          <div
            key={dir}
            className={`flick-cell flick-${AREA[dir]}${current === dir ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <span className="flick-char" lang="ja">
              {char}
            </span>
            <span className="flick-dir">{labels[dir]}</span>
          </div>
        );
      })}
      {current ? (
        <span
          className="flick-finger"
          style={{ '--dx': dx, '--dy': dy } as CSSProperties}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
