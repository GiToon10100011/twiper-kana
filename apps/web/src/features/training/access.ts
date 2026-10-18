import { currentLevel, unlockedLevels } from '@twiper/core';
import { levels } from '@twiper/content';
import { clearedLevels, loadProgress, type Progress } from '../../lib/progress';
import { loadSettings } from '../../lib/settings';

const ORDER = levels.map((level) => level.id);

export interface LevelAccess {
  readonly progress: Progress;
  readonly unlocked: ReadonlySet<string>;
  /** 이어서 할 레벨 */
  readonly current: string | null;
}

/** 저장된 진행과 설정으로 지금 열린 레벨을 계산한다. 화면을 그릴 때마다 새로 읽는다 */
export function levelAccess(): LevelAccess {
  const progress = loadProgress();
  const cleared = clearedLevels(progress);
  const unlocked = unlockedLevels(ORDER, cleared, loadSettings().unlockAll);
  return { progress, unlocked, current: currentLevel(ORDER, cleared, unlocked) };
}
