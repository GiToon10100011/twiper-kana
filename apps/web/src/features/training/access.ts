import { frontierLevel, unlockedLevels } from '@twiper/core';
import { levels } from '@twiper/content';
import { clearedLevels, loadProgress, type Progress } from '../../lib/progress';
import { loadSettings } from '../../lib/settings';

const ORDER = levels.map((level) => level.id);

export interface LevelAccess {
  readonly progress: Progress;
  readonly unlocked: ReadonlySet<string>;
  /** 이어서 할 레벨 = 최고 진도. 마지막 레벨까지 끝냈으면 null */
  readonly current: string | null;
}

/** 진행 기록으로 열린 레벨과 이어서 할 레벨을 계산한다 */
export function accessFor(progress: Progress, unlockAll = false): LevelAccess {
  const cleared = clearedLevels(progress);
  const unlocked = unlockedLevels(ORDER, cleared, unlockAll);
  return { progress, unlocked, current: frontierLevel(ORDER, cleared) };
}

/** 저장된 진행과 설정으로 지금 열린 레벨을 계산한다. 화면을 그릴 때마다 새로 읽는다 */
export function levelAccess(): LevelAccess {
  return accessFor(loadProgress(), loadSettings().unlockAll);
}
