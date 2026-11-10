import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import { weakDrill, type Level } from '@twiper/content';
import type { TrainingRepo } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { loadReviewPlan } from '../../lib/review';
import { BackIcon } from '../../ui/icons';
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
 * 기록을 읽는 동안은 빈 화면, 오늘 복습할 것이 없으면 홈으로 돌려보낸다.
 * 읽지 못하면 복습할 것이 없는 것으로 보지 않고, 그렇다고 알린 뒤 다시 읽거나 홈으로 가게 한다
 */
export function ReviewPractice({ repo }: { repo?: TrainingRepo }) {
  const { t } = useTranslation();
  const [units, setUnits] = useState<readonly string[] | 'failed' | null>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let alive = true;
    loadReviewPlan(repo ?? trainingRepo()).then(
      (plan) => {
        if (alive) setUnits(plan.due.map((item) => item.unit));
      },
      () => {
        if (alive) setUnits('failed');
      },
    );
    return () => {
      alive = false;
    };
  }, [repo, reads]);

  const level = useMemo(
    () => (Array.isArray(units) && units.length > 0 ? reviewLevel(units) : null),
    [units],
  );

  if (units === null) return <main className="screen" aria-busy="true" />;
  if (units === 'failed') {
    return (
      <main className="screen">
        <header className="screen-header">
          <Link className="icon-btn header-back" to="/" aria-label={t('review.toHome')}>
            <BackIcon />
          </Link>
        </header>
        <h1 className="screen-title">{t('review.title')}</h1>
        <p className="screen-body" role="alert">
          {t('review.failed')}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setUnits(null);
            setReads((n) => n + 1);
          }}
        >
          {t('review.retry')}
        </button>
      </main>
    );
  }
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
