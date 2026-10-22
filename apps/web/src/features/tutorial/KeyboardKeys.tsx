import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { iosKana } from '@twiper/content';
import type { FlickDirection, GuideKey } from '@twiper/core';
import {
  ArrowRightIcon,
  DeleteIcon,
  GlobeIcon,
  MicIcon,
  RotateCcwIcon,
  SmileIcon,
} from '../../ui/icons';
import { FlickDiagram } from './FlickDiagram';

/** toggle: 「フリックのみ」 끔(iOS 기본) / flickOnly: 켬 */
type Mode = 'toggle' | 'flickOnly';
type FnId =
  | 'next'
  | 'undo'
  | 'number'
  | 'abc'
  | 'kana'
  | 'emoji'
  | 'modifier'
  | 'delete'
  | 'space'
  | 'return'
  | 'globe'
  | 'mic';
/** 기능 키는 이름, 글자 키는 'kana:' + 가이드의 키 id */
type KeyId = FnId | `kana:${string}`;

interface Cell {
  readonly id: KeyId;
  readonly label: ReactNode;
  /** 4행 × 5열에서의 위치 (0부터) */
  readonly row: number;
  readonly col: number;
  /** 두 행을 차지한다 (確定 키) */
  readonly tall?: boolean;
}

/*
 * iPhone かな 키보드 배치. 2026-10-23 사용자 iPhone 스크린샷(「フリックのみ」 끔/켬) 기준.
 * 두 상태는 왼쪽 줄만 다르다: 끄면 → ↺ ABC 이모지, 켜면 ☆123 ABC あいう 이모지.
 */
const SIDE: Record<Mode, readonly Cell[]> = {
  toggle: [
    { id: 'next', label: <ArrowRightIcon />, row: 0, col: 0 },
    { id: 'undo', label: <RotateCcwIcon />, row: 1, col: 0 },
    { id: 'abc', label: 'ABC', row: 2, col: 0 },
    { id: 'emoji', label: <SmileIcon />, row: 3, col: 0 },
  ],
  flickOnly: [
    { id: 'number', label: '☆123', row: 0, col: 0 },
    { id: 'abc', label: 'ABC', row: 1, col: 0 },
    { id: 'kana', label: 'あいう', row: 2, col: 0 },
    { id: 'emoji', label: <SmileIcon />, row: 3, col: 0 },
  ],
};

const RIGHT: readonly Cell[] = [
  { id: 'delete', label: <DeleteIcon />, row: 0, col: 4 },
  { id: 'space', label: '空白', row: 1, col: 4 },
  { id: 'return', label: '確定', row: 2, col: 4, tall: true },
];

/** 가운데 3열: 가이드의 글자 키와 「小゛゜」 키 (아무것도 치지 않았을 때는 「^^」로 보인다) */
const MIDDLE: readonly Cell[] = [
  ...iosKana.layers.kana.keys.map((key): Cell => ({
    id: `kana:${key.id}`,
    label: key.label,
    row: key.row,
    col: key.col + 1,
  })),
  { id: 'modifier', label: '^^', row: iosKana.modifier.row, col: iosKana.modifier.col + 1 },
];

const BOTTOM: readonly Cell[] = [
  { id: 'globe', label: <GlobeIcon />, row: 4, col: 0 },
  { id: 'mic', label: <MicIcon />, row: 4, col: 4 },
];

const guideKey = (id: KeyId): GuideKey | undefined =>
  id.startsWith('kana:')
    ? iosKana.layers.kana.keys.find((key) => `kana:${key.id}` === id)
    : undefined;

/**
 * 키보드의 다른 키: 실제와 같은 배치의 かな 키보드를 그리고, 누른 키의 역할을 아래에 보여 준다.
 * 설명용 도해이며 입력은 받지 않는다. 튜토리얼과 키보드 설명서(/keys)에서 쓴다.
 */
export function KeyboardKeys() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('toggle');
  const [selected, setSelected] = useState<KeyId>('next');

  const labels: Record<FlickDirection, string> = {
    tap: t('onboarding.flick.tap'),
    left: t('onboarding.flick.left'),
    up: t('onboarding.flick.up'),
    right: t('onboarding.flick.right'),
    down: t('onboarding.flick.down'),
  };

  const nameOf = (id: KeyId) => {
    const key = guideKey(id);
    return key ? t('keys.kana', { label: key.label }) : t(`keys.items.${id as FnId}.name`);
  };

  // 보던 키가 왼쪽 줄에서 사라지면 같은 자리의 키로 넘어간다
  const changeMode = (next: Mode) => {
    const at = SIDE[mode].find((cell) => cell.id === selected);
    if (at && !SIDE[next].some((cell) => cell.id === selected)) {
      setSelected(SIDE[next].find((cell) => cell.row === at.row)?.id ?? 'abc');
    }
    setMode(next);
  };

  const button = (cell: Cell) => {
    const fn = !cell.id.startsWith('kana:') && cell.id !== 'modifier';
    const style: CSSProperties = {
      gridRow: cell.tall ? `${cell.row + 1} / span 2` : cell.row + 1,
      gridColumn: cell.col + 1,
    };
    return (
      <button
        key={cell.id}
        type="button"
        className={`kbd-key${fn ? ' is-fn' : ''}`}
        style={style}
        aria-label={nameOf(cell.id)}
        aria-pressed={selected === cell.id}
        onClick={() => setSelected(cell.id)}
      >
        <span lang="ja" aria-hidden="true">
          {cell.label}
        </span>
      </button>
    );
  };

  const key = guideKey(selected);

  return (
    <div className="keyboard-keys">
      <div className="lab-choice">
        <span>{t('keys.mode')}</span>
        <div className="stage-tabs is-small" role="group" aria-label={t('keys.mode')}>
          {(['toggle', 'flickOnly'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="stage-tab"
              aria-pressed={mode === option}
              onClick={() => changeMode(option)}
            >
              {t(option === 'toggle' ? 'keys.off' : 'keys.on')}
            </button>
          ))}
        </div>
      </div>
      <p className="screen-note">{t('keys.modeNote')}</p>

      <div className="kbd" role="group" aria-label={t('keys.diagram')}>
        {[...SIDE[mode], ...MIDDLE, ...RIGHT, ...BOTTOM].map(button)}
      </div>

      <section className="key-explain" aria-label={t('keys.explain')} aria-live="polite">
        <h3>{nameOf(selected)}</h3>
        {key ? (
          <>
            <p>{t('keys.kanaDesc', { tap: key.outputs.tap })}</p>
            <FlickDiagram keyDef={key} labels={labels} compact />
          </>
        ) : (
          <p>{t(`keys.items.${selected as FnId}.desc`)}</p>
        )}
      </section>
    </div>
  );
}
