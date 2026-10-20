import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levels } from '@twiper/content';
import type { LevelRecord } from '../../lib/progress';
import { BackIcon } from '../../ui/icons';
import { accessFor, levelAccess, type LevelAccess } from '../training/access';
import { CourseTiles } from '../training/CourseTiles';

type Sample = 'midway' | 'fresh' | 'skipped' | 'allDone' | 'real';

const cleared = (bestAccuracy: number): LevelRecord => ({
  clearedAt: '2026-10-19T00:00:00.000Z',
  plays: 1,
  bestAccuracy,
  bestKpm: null,
});

/** 진행 예시. 가짜 기록이며 저장소에는 쓰지 않는다 */
const SAMPLES: Record<Exclude<Sample, 'real'>, { label: string; access: () => LevelAccess }> = {
  // Lv.1–3을 끝내고 Lv.4를 할 차례
  midway: {
    label: 'Lv.4 차례',
    access: () => accessFor({ L1: cleared(0.98), L2: cleared(0.93), L3: cleared(0.86) }),
  },
  fresh: { label: '처음', access: () => accessFor({}) },
  // 모두 열기를 켜고 Lv.1–3과 Lv.12를 끝냄 → 최고 진도는 Lv.13
  skipped: {
    label: '전체 열기',
    access: () =>
      accessFor(
        { L1: cleared(0.98), L2: cleared(0.93), L3: cleared(0.86), L12: cleared(0.91) },
        true,
      ),
  },
  allDone: {
    label: '모두 끝냄',
    access: () =>
      accessFor(
        Object.fromEntries(levels.map((level, i) => [level.id, cleared(0.8 + (i % 5) * 0.04)])),
      ),
  },
};

const OPTIONS: readonly (readonly [Sample, string])[] = [
  ...(Object.entries(SAMPLES) as [Exclude<Sample, 'real'>, { label: string }][]).map(
    ([sample, { label }]) => [sample, label] as const,
  ),
  ['real', '내 기록'],
];

/** 홈 코스 목록을 여러 진행 상태로 미리 본다. 가짜 기록은 저장하지 않는다 */
export function CourseTilesLab() {
  const { t } = useTranslation();
  const [sample, setSample] = useState<Sample>('midway');
  const access = sample === 'real' ? levelAccess() : SAMPLES[sample].access();

  return (
    <main className="lab">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>목록 상태 미리보기</span>
      </header>

      <div className="lab-choice">
        <span>진행 예시</span>
        <div className="stage-tabs" role="group" aria-label="진행 예시">
          {OPTIONS.map(([option, text]) => (
            <button
              key={option}
              type="button"
              className="stage-tab"
              aria-pressed={option === sample}
              onClick={() => setSample(option)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-label">{t('course.title')}</h2>
      <CourseTiles key={sample} access={access} />
    </main>
  );
}
