import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { weakDrill, type Level } from '@twiper/content';
import type { TrainingRepo } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadReviewPlan } from '../../lib/review';
import { Drill } from '../training/Drill';

/** 복습의 시도·세션 기록 id. 레벨 진도에는 넣지 않는다 */
export const REVIEW_LEVEL_ID = 'review';

/** 오늘 복습할 단위로 만든 연습을 레벨 모양으로 (약점 연습과 같은 줄 드릴) */
const reviewLevel = (units: readonly string[]): Level => ({
  id: REVIEW_LEVEL_ID,
  number: 0,
  stage: 'basic',
  kind: 'combo',
  keys: [],
  drill: weakDrill(units),
});

/**
 * /review: 오늘 복습할 단위로 한 판 (계획 §10.3). 친 줄은 기록에 남고, 복습 일정은 그 기록에서 다시 계산된다.
 * 기록을 읽는 동안은 빈 화면, 오늘 복습할 것이 없으면 홈으로 돌려보낸다
 */
export function ReviewPractice({ repo }: { repo?: TrainingRepo }) {
  const { t } = useTranslation();
  const [units, setUnits] = useState<readonly string[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadReviewPlan(repo ?? trainingRepo()).then((plan) => {
      if (alive) setUnits(plan.due.map((item) => item.unit));
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  const level = useMemo(() => (units && units.length > 0 ? reviewLevel(units) : null), [units]);

  if (units === null) return <main className="screen" aria-busy="true" />;
  if (!level) return <Navigate to="/" replace />;
  return (
    <Drill
      level={level}
      practice={{
        title: t('review.title'),
        intro: t('review.intro', { units: units.join('・'), count: level.drill.lineCount }),
        backTo: '/',
        backLabel: t('review.toHome'),
        passNote: t('review.pass'),
        practiceNote: t('review.practice'),
      }}
    />
  );
}
