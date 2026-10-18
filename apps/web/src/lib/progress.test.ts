// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearedLevels, loadProgress, recordLevel } from './progress';
import { loadSettings, saveSettings } from './settings';

afterEach(() => localStorage.clear());

describe('progress', () => {
  it('처음에는 비어 있다', () => {
    expect(loadProgress()).toEqual({});
  });

  it('끝낸 레벨을 기록하고 최고 기록을 남긴다', () => {
    const first = new Date('2026-10-18T05:00:00Z');
    recordLevel('L1', { accuracy: 0.8, kpm: 40 }, first);
    recordLevel('L1', { accuracy: 0.95, kpm: null }, new Date('2026-10-19T05:00:00Z'));

    expect(loadProgress()).toEqual({
      L1: { clearedAt: first.toISOString(), plays: 2, bestAccuracy: 0.95, bestKpm: 40 },
    });
    expect(clearedLevels(loadProgress())).toEqual(new Set(['L1']));
  });

  it('깨진 값과 모양이 다른 항목은 버린다', () => {
    localStorage.setItem('twiper.progress.v1', '{not json');
    expect(loadProgress()).toEqual({});

    localStorage.setItem(
      'twiper.progress.v1',
      JSON.stringify({
        L1: { clearedAt: 'x', plays: 1, bestAccuracy: 1, bestKpm: null },
        L2: { plays: 'many' },
      }),
    );
    expect(Object.keys(loadProgress())).toEqual(['L1']);
  });
});

describe('settings', () => {
  it('기본값은 순서대로 열기', () => {
    expect(loadSettings()).toEqual({ unlockAll: false });
  });

  it('모두 열기를 저장하고 읽는다', () => {
    saveSettings({ unlockAll: true });

    expect(loadSettings()).toEqual({ unlockAll: true });
  });

  it('true가 아닌 값은 꺼진 것으로 본다', () => {
    localStorage.setItem('twiper.settings.v1', JSON.stringify({ unlockAll: 'yes' }));

    expect(loadSettings()).toEqual({ unlockAll: false });
  });
});
