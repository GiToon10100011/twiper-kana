import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { LevelRecord, Progress } from '../../lib/progress';
import { BackIcon } from '../../ui/icons';
import { accessFor, levelAccess } from '../training/access';
import { CourseTiles } from '../training/CourseTiles';

type Sample = 'midway' | 'fresh' | 'real';

const cleared = (bestAccuracy: number): LevelRecord => ({
  clearedAt: '2026-10-19T00:00:00.000Z',
  plays: 1,
  bestAccuracy,
  bestKpm: null,
});

/** Lv.1–3을 끝내고 Lv.4를 할 차례인 예시. 저장소에는 쓰지 않는다 */
const MIDWAY: Progress = { L1: cleared(0.98), L2: cleared(0.93), L3: cleared(0.86) };

interface Choice<T extends string> {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: Choice<T>) {
  return (
    <div className="lab-choice">
      <span>{label}</span>
      <div className="stage-tabs" role="group" aria-label={label}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className="stage-tab"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 코스 목록 새 레이아웃 시안. 홈의 목록은 그대로 두고 여기서만 보여 준다 */
export function CourseTilesLab() {
  const { t } = useTranslation();
  const [view, setView] = useState<'all' | 'tabs'>('all');
  const [sample, setSample] = useState<Sample>('midway');
  const access = sample === 'real' ? levelAccess() : accessFor(sample === 'midway' ? MIDWAY : {});

  return (
    <main className="lab">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>목록 시안</span>
      </header>

      <div className="lab-choices">
        <Segmented
          label="보기"
          value={view}
          options={[
            ['all', '전체'],
            ['tabs', '단계 탭'],
          ]}
          onChange={setView}
        />
        <Segmented
          label="진행 예시"
          value={sample}
          options={[
            ['midway', 'Lv.4 차례'],
            ['fresh', '처음'],
            ['real', '내 기록'],
          ]}
          onChange={setSample}
        />
      </div>

      <h2 className="section-label">{t('course.title')}</h2>
      <CourseTiles key={sample} access={access} tabs={view === 'tabs'} />
    </main>
  );
}
