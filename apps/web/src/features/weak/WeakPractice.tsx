import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { weakDrill, type Level } from '@twiper/content';
import { weakUnits, type TrainingRepo } from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { RECENT_ATTEMPTS } from '../stats/Stats';
import { Drill } from '../training/Drill';

/** 약점 연습의 시도·세션 기록 id. 레벨 진도에는 넣지 않는다 */
export const WEAK_LEVEL_ID = 'weak';

/** 약점 단위로 만든 연습을 레벨 모양으로 (줄 드릴 화면을 그대로 쓴다) */
const weakLevel = (units: readonly string[]): Level => ({
  id: WEAK_LEVEL_ID,
  number: 0,
  stage: 'basic',
  kind: 'combo',
  keys: [],
  drill: weakDrill(units),
});

/**
 * /weak: 최근 기록의 약점 단위로 한 판 (2026-10-26 시안 A 채택 — 「내 실력」 맨 위 카드에서 들어온다).
 * 기록을 읽는 동안은 빈 화면, 약점이 없으면 내 실력으로 돌려보낸다
 */
export function WeakPractice({ repo }: { repo?: TrainingRepo }) {
  const { t } = useTranslation();
  const [units, setUnits] = useState<readonly string[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (repo ?? trainingRepo()).recentAttempts(RECENT_ATTEMPTS).then((list) => {
      if (alive) setUnits(weakUnits(list).map((weak) => weak.unit));
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  const level = useMemo(() => (units && units.length > 0 ? weakLevel(units) : null), [units]);

  if (units === null) return <main className="screen" aria-busy="true" />;
  if (!level) return <Navigate to="/stats" replace />;
  return (
    <Drill
      level={level}
      practice={{
        title: t('weak.title'),
        intro: t('weak.intro', { units: units.join('・'), count: level.drill.lineCount }),
        backTo: '/stats',
        backLabel: t('weak.toStats'),
        passNote: t('weak.pass'),
        practiceNote: t('weak.practice'),
      }}
    />
  );
}
