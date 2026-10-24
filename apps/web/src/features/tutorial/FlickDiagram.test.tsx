// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iosKana } from '@twiper/content';
import type { GuideKey } from '@twiper/core';
import { FlickDiagram } from './FlickDiagram';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const labels = { tap: '탭', left: '왼쪽', up: '위', right: '오른쪽', down: '아래' } as const;

const keyOf = (layer: 'kana' | 'number', id: string): GuideKey => {
  const key = iosKana.layers[layer].keys.find((k) => k.id === id);
  if (!key) throw new Error(`${layer} 자판에 ${id} 키 없음`);
  return key;
};

/** 애니메이션이 steps번 넘어가는 동안 강조된 칸의 글자 (강조가 없으면 '') */
async function activeChars(key: GuideKey, steps: number): Promise<string[]> {
  const { container } = render(<FlickDiagram keyDef={key} labels={labels} />);
  const seen: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    seen.push(container.querySelector('.flick-cell.is-active .flick-char')?.textContent ?? '');
    await act(() => vi.advanceTimersByTimeAsync(1200));
  }
  return seen;
}

describe('FlickDiagram', () => {
  it('글자가 다섯 방향에 다 있으면 탭 → ← → ↑ → → → ↓를 돈다', async () => {
    expect(await activeChars(keyOf('kana', 'a'), 6)).toEqual(['あ', 'い', 'う', 'え', 'お', 'あ']);
  });

  it('글자가 없는 방향으로는 움직이지 않는다 (わ 키는 ↓, ☆123의 0 키는 →↓가 없다)', async () => {
    expect(await activeChars(keyOf('kana', 'wa'), 5)).toEqual(['わ', 'を', 'ん', 'ー', 'わ']);
    expect(await activeChars(keyOf('number', '0'), 4)).toEqual(['0', '〜', '…', '0']);
  });

  it('아래 방향 글자가 없는 키는 빈 아랫줄을 두지 않는다', () => {
    const { container } = render(<FlickDiagram keyDef={keyOf('kana', 'punct')} labels={labels} />);

    expect(container.querySelector('.flick')?.classList.contains('is-no-down')).toBe(true);
  });
});
