import { useEffect, useState } from 'react';
import { iosKana } from '@twiper/content';
import type { FlickDirection } from '@twiper/core';
import { KeyboardGrid } from './KeyboardGrid';

const { kana } = iosKana.layers;
const DIRECTIONS: readonly FlickDirection[] = ['tap', 'left', 'up', 'right', 'down'];

/** 50음 순서 (행의 첫 글자 키) */
const ROW_ORDER = ['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa'];

/** 방향마다 나오는 단(모음). を·ん·ー·괄호·문장부호는 규칙 밖이라 넣지 않는다 */
const DAN: Record<FlickDirection, string> = {
  tap: 'あかさたなはまやらわ',
  left: 'いきしちにひみり',
  up: 'うくすつぬふむゆる',
  right: 'えけせてねへめれ',
  down: 'おこそとのほもよろ',
};

/** 배치 도해에서 키 하나를 짚는 시간 */
const LAYOUT_STEP_MS = 600;
/** 모음 도해에서 한 방향을 보여 주는 시간. 한 단의 글자 8–10개를 읽을 수 있을 만큼 둔다 */
const VOWEL_STEP_MS = 3200;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.(REDUCED_MOTION).matches === true;

/** Part 2: 키 배치. 가운데 글자를 50음 순서대로 하나씩 짚는다 */
export function LayoutTour({ label }: { label: string }) {
  const [reduced] = useState(prefersReducedMotion);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(
      () => setStep((s) => (s + 1) % (ROW_ORDER.length + 2)),
      LAYOUT_STEP_MS,
    );
    return () => clearInterval(timer);
  }, [reduced]);

  // 한 바퀴를 돈 뒤 잠깐 멈췄다가 다시 시작한다. 움직임을 줄이면 행 키 전체를 한 번에 강조한다.
  const highlight = new Set(reduced ? ROW_ORDER : ROW_ORDER.slice(step, step + 1));
  return (
    <KeyboardGrid
      layer={kana}
      modifier={iosKana.modifier}
      direction="label"
      highlight={highlight}
      label={label}
    />
  );
}

interface VowelTourProps {
  /** 방향 버튼 이름: 「왼쪽 = い단」 */
  legend: Record<FlickDirection, string>;
  label: string;
}

/** Part 3: 방향 = 모음. 방향을 바꿔 가며 어느 키든 같은 단이 나오는 것을 보여 준다 */
export function VowelTour({ legend, label }: VowelTourProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [direction, setDirection] = useState<FlickDirection>('left');
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (reduced || picked) return;
    const timer = setInterval(() => {
      setDirection((d) => DIRECTIONS[(DIRECTIONS.indexOf(d) + 1) % DIRECTIONS.length] ?? 'tap');
    }, VOWEL_STEP_MS);
    return () => clearInterval(timer);
  }, [reduced, picked]);

  const dan = DAN[direction];
  const inDan = kana.keys.filter((key) => dan.includes(key.outputs[direction] ?? '\u{0}'));
  const highlight = new Set(inDan.map((key) => key.id));
  const muted = new Set(kana.keys.filter((key) => !highlight.has(key.id)).map((key) => key.id));

  return (
    <div className="vowel-tour">
      <div className="dir-tabs" role="group" aria-label={label}>
        {DIRECTIONS.map((dir) => (
          <button
            key={dir}
            type="button"
            className={`dir-tab${dir === direction ? ' is-active' : ''}`}
            aria-pressed={dir === direction}
            onClick={() => {
              setPicked(true);
              setDirection(dir);
            }}
          >
            {legend[dir]}
          </button>
        ))}
      </div>
      <KeyboardGrid
        layer={kana}
        modifier={iosKana.modifier}
        direction={direction}
        highlight={highlight}
        muted={muted}
        label={`${label}: ${legend[direction]}`}
      />
      <p className="dan-row" lang="ja" data-testid="dan-row">
        {inDan.map((key) => key.outputs[direction]).join(' ')}
      </p>
    </div>
  );
}
