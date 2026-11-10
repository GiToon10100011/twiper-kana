import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { addDays, dayKey, recentDays, streakOf } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadReviewPlan, type ReviewPlan } from '../../lib/review';
import type { TodayData } from '../../lib/today';
import { BackIcon } from '../../ui/icons';
import { Today } from '../home/Today';
import { ReviewEntry, type ReviewLayout } from '../review/ReviewEntry';

type Sample = 'due' | 'later' | 'real';

const LAYOUTS: readonly (readonly [ReviewLayout, string])[] = [
  ['card', 'A. 카드'],
  ['row', 'B. 한 줄'],
];

const SAMPLES: readonly (readonly [Sample, string])[] = [
  ['due', '예시: 복습 있음'],
  ['later', '예시: 오늘은 없음'],
  ['real', '이 기기 기록'],
];

const item = (unit: string, step: number, due: string) => ({ unit, step, due });

/** 예시 복습. 가짜이며 저장소에는 쓰지 않는다 */
function samplePlan(today: string, sample: Exclude<Sample, 'real'>): ReviewPlan {
  if (sample === 'later')
    return { due: [], dueCount: 0, next: { day: addDays(today, 2), count: 3 } };
  const due = [
    item('ぎ', 0, addDays(today, -2)),
    item('しゃ', 0, today),
    item('っ', 1, today),
    item('ぴ', 1, today),
    item('る', 2, today),
    item('ぢ', 3, today),
  ];
  return { due, dueCount: due.length, next: null };
}

/** 예시 「오늘」 띠: 최근 7일 중 5일 연습, 오늘은 아직 */
function sampleToday(today: string): TodayData {
  const days = new Set(recentDays(today).slice(1, 6));
  return { today, days, streak: streakOf(days, today), todayMs: 0, todayChars: 0 };
}

/** 홈에 넣을 오늘 복습 시안을 예시나 이 기기의 기록으로 미리 본다 (시작을 누르면 실제 /review로 간다) */
export function ReviewLab() {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<ReviewLayout>('card');
  const [sample, setSample] = useState<Sample>('due');
  const [real, setReal] = useState<ReviewPlan | null>(null);
  const today = dayKey(new Date());

  useEffect(() => {
    if (sample !== 'real' || real !== null) return;
    void loadReviewPlan(trainingRepo()).then(setReal);
  }, [sample, real]);

  const plan = sample === 'real' ? real : samplePlan(today, sample);

  const choice = <T extends string>(
    name: string,
    options: readonly (readonly [T, string])[],
    value: T,
    set: (next: T) => void,
  ) => (
    <div className="lab-choice">
      <span>{name}</span>
      <div className="stage-tabs is-small" role="group" aria-label={name}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className="stage-tab"
            aria-pressed={option === value}
            onClick={() => set(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main className="lab">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>복습 시안</span>
      </header>
      {choice('시안', LAYOUTS, layout, setLayout)}
      {choice('기록', SAMPLES, sample, setSample)}
      {sample === 'real' && real !== null && real.dueCount === 0 && !real.next ? (
        <p className="screen-note">
          이 기기에는 복습할 글자가 없어요. 틀린 적이 있는 기록을 가져오면(설정 › 기록 백업) 볼 수
          있어요.
        </p>
      ) : null}

      <h2 className="section-label">홈 위쪽</h2>
      <div className="today-slot">
        <Today data={sampleToday(today)} />
      </div>
      {plan ? <ReviewEntry plan={plan} layout={layout} /> : null}
    </main>
  );
}
