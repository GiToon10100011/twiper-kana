import { useEffect, useState } from 'react';
import { addDays, dayKey, streakOf, type SkillId, type SkillStat } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadToday, type TodayData } from '../../lib/today';
import { Home } from '../home/Home';
import { Today, type TodayVariant } from '../home/Today';

type Sample = 'fresh' | 'done' | 'yet' | 'broken' | 'real';

const weak = (skill: SkillId, accuracy: number): SkillStat => ({
  skill,
  samples: 30,
  firstTry: Math.round(30 * accuracy),
  accuracy,
  medianMs: 900,
});

/** 오늘에서 며칠 전에 연습했는지로 만든 가짜 기록. 저장소에는 쓰지 않는다 */
function sample(daysAgo: readonly number[], extra: Partial<TodayData> = {}): TodayData {
  const today = dayKey(new Date());
  const days = new Set(daysAgo.map((n) => addDays(today, -n)));
  return {
    today,
    days,
    streak: streakOf(days, today),
    todayMs: 0,
    todayChars: 0,
    weakest: null,
    ...extra,
  };
}

const SAMPLES: Record<Exclude<Sample, 'real'>, { label: string; data: () => TodayData }> = {
  fresh: { label: '처음', data: () => sample([]) },
  done: {
    label: '오늘 함·5일',
    data: () =>
      sample([0, 1, 2, 3, 4, 6], {
        todayMs: 4 * 60_000 + 20_000,
        todayChars: 128,
        weakest: weak('dakuten', 0.73),
      }),
  },
  yet: {
    label: '오늘 아직·3일',
    data: () => sample([1, 2, 3, 5], { weakest: weak('row:さ', 0.84) }),
  },
  broken: { label: '끊김', data: () => sample([3, 4, 5, 6, 10, 11, 12, 13, 14]) },
};

const VARIANTS: readonly (readonly [TodayVariant, string])[] = [
  ['strip', 'A. 띠'],
  ['card', 'B. 카드+추천'],
];

/** 홈 「오늘」(연속 기록·오늘 추천) 시안. 실제 홈 위에 얹어 본다 */
export function TodayLab() {
  const [variant, setVariant] = useState<TodayVariant>('strip');
  const [sampleId, setSampleId] = useState<Sample>('done');
  const [real, setReal] = useState<TodayData | null>(null);

  useEffect(() => {
    if (sampleId !== 'real') return;
    let alive = true;
    void loadToday(trainingRepo()).then((data) => {
      if (alive) setReal(data);
    });
    return () => {
      alive = false;
    };
  }, [sampleId]);

  const data = sampleId === 'real' ? real : SAMPLES[sampleId].data();
  const options: readonly (readonly [Sample, string])[] = [
    ...(Object.entries(SAMPLES) as [Exclude<Sample, 'real'>, { label: string }][]).map(
      ([id, { label }]) => [id, label] as const,
    ),
    ['real', '내 기록'],
  ];

  return (
    <>
      <div className="lab-controls">
        <div className="lab-choice">
          <span>배치</span>
          <div className="stage-tabs is-small" role="group" aria-label="배치">
            {VARIANTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="stage-tab"
                aria-pressed={variant === id}
                onClick={() => setVariant(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="lab-choice">
          <span>기록</span>
          <div className="stage-tabs is-small" role="group" aria-label="기록">
            {options.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="stage-tab"
                aria-pressed={sampleId === id}
                onClick={() => setSampleId(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Home top={data ? <Today data={data} variant={variant} /> : null} />
    </>
  );
}
