import { describe, expect, it } from 'vitest';
import { isQuietPath } from './quietPath';

describe('isQuietPath', () => {
  it('치는 화면에서는 새 버전 알림을 띄우지 않는다', () => {
    for (const path of ['/train/L1', '/test/kana', '/weak', '/review', '/tutorial']) {
      expect(isQuietPath(path)).toBe(true);
    }
  });

  it('홈·설정·내 실력 같은 화면에서는 띄운다', () => {
    for (const path of ['/', '/steps', '/settings', '/stats', '/calendar', '/keys', '/find']) {
      expect(isQuietPath(path)).toBe(false);
    }
  });
});
