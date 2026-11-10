import { useEffect, useState } from 'react';
import type { TrainingRepo } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadReviewPlan, type ReviewPlan } from '../../lib/review';
import { useDailyReads } from '../home/useToday';

/**
 * 홈의 오늘 복습을 읽는다. 「오늘」 띠와 같이 날이 바뀌었을 수 있으면 다시 읽는다.
 * now를 주면(테스트) 그 시각으로 한 번만 읽는다. 읽지 못하면 null로 남는다
 */
export function useReviewPlan(repo?: TrainingRepo, now?: Date): ReviewPlan | null {
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const reads = useDailyReads(now);

  useEffect(() => {
    let alive = true;
    loadReviewPlan(repo ?? trainingRepo(), now).then(
      (loaded) => {
        if (alive) setPlan(loaded);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [repo, now, reads]);

  return plan;
}
