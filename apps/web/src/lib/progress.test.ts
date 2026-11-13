// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearedLevels, loadProgress, recordLevel } from './progress';
import { loadSettingStamps, loadSettings, saveSettings } from './settings';

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
  it('기본값은 순서대로 열기, 도움말은 3분 멈추면, 한자는 바꿔야 정답, 언어는 기기를 따른다', () => {
    expect(loadSettings()).toEqual({
      unlockAll: false,
      helpIdleMs: 180_000,
      requireKanji: true,
      language: 'auto',
      speedUnit: 'kpm',
    });
  });

  it('모두 열기·도움말 기다리는 시간·한자 바꾸기·언어·속도 단위를 저장하고 읽는다', () => {
    saveSettings({
      unlockAll: true,
      helpIdleMs: 0,
      requireKanji: false,
      language: 'en',
      speedUnit: 'cpm',
    });

    expect(loadSettings()).toEqual({
      unlockAll: true,
      helpIdleMs: 0,
      requireKanji: false,
      language: 'en',
      speedUnit: 'cpm',
    });
  });

  it('true가 아닌 값은 꺼진 것으로, 고를 수 없는 시간은 기본값으로 본다', () => {
    localStorage.setItem(
      'twiper.settings.v1',
      JSON.stringify({
        unlockAll: 'yes',
        helpIdleMs: 5000,
        requireKanji: 'no',
        language: 'fr',
        speedUnit: 'fast',
      }),
    );

    // 한자 바꾸기는 false일 때만 끈다. 고를 수 없는 언어는 기기를 따른다
    expect(loadSettings()).toEqual({
      unlockAll: false,
      helpIdleMs: 180_000,
      requireKanji: true,
      language: 'auto',
      speedUnit: 'kpm',
    });
  });

  it('도움말 시간·한자 바꾸기·언어가 없던 예전 설정은 기본값으로 읽는다', () => {
    localStorage.setItem('twiper.settings.v1', JSON.stringify({ unlockAll: true }));

    expect(loadSettings()).toEqual({
      unlockAll: true,
      helpIdleMs: 180_000,
      requireKanji: true,
      language: 'auto',
      speedUnit: 'kpm',
    });
  });

  it('바꾼 항목에만 바꾼 때와 기기를 찍고, 다음에 찍는 때는 앞서 찍은 때보다 늦다', () => {
    saveSettings({ ...loadSettings(), speedUnit: 'cpm' }, 1_000);
    const first = loadSettingStamps();
    expect(Object.keys(first)).toEqual(['speedUnit']);
    expect(first.speedUnit?.at).toBe(1_000);
    expect(first.speedUnit?.deviceId).toMatch(/^[0-9A-Z]{26}$/u);

    // 시계가 거꾸로 가도 나중에 바꾼 것이 늦게 찍힌다
    saveSettings({ ...loadSettings(), unlockAll: true }, 500);
    expect(loadSettingStamps().unlockAll?.at).toBe(1_001);
    expect(loadSettingStamps().speedUnit?.at).toBe(1_000);

    // 바뀐 것이 없으면 찍지 않는다
    saveSettings(loadSettings(), 9_000);
    expect(loadSettingStamps().unlockAll?.at).toBe(1_001);
  });
});
