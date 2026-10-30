import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levelForSkill } from '@twiper/content';
import {
  confusions,
  skillStats,
  slowUnits,
  STATS_MIN_SAMPLES,
  weakUnits,
  type AttemptRecord,
  type SkillId,
  type SkillStat,
  type TopicSkill,
  type TrainingRepo,
} from '@twiper/core';
import { trainingRepo } from '../../lib/db';
import { BackIcon } from '../../ui/icons';
import { levelAccess } from '../training/access';
import { skillName } from '../training/levelTitle';
import { WeakCard, type WeakBack } from '../weak/WeakEntry';

/** 통계에 읽어 올 최근 시도 수. 한 판이 10줄 안팎이라 수백 판 분량이다 (약점 연습도 같은 기록을 본다) */
export const RECENT_ATTEMPTS = 2000;

/** 이보다 정확도가 낮은 규칙은 그 레벨로 돌아가길 권한다 (레벨 통과 기준과 같은 90%) */
const BACK_ACCURACY = 0.9;

type Stage = 'basic' | 'combo' | 'katakana' | 'symbol';

/** 규칙이 속한 코스 단계 (레벨 목록의 탭과 같다) */
const TOPIC_STAGE: Record<TopicSkill, Stage> = {
  dakuten: 'combo',
  handakuten: 'combo',
  small: 'combo',
  yoon: 'combo',
  sokuon: 'combo',
  katakana: 'katakana',
  longVowel: 'katakana',
  foreign: 'katakana',
  vu: 'katakana',
  punct: 'symbol',
  symbol: 'symbol',
};

const stageOf = (skill: SkillId): Stage =>
  skill.startsWith('row:') ? 'basic' : TOPIC_STAGE[skill as TopicSkill];

const STAGES: readonly Stage[] = ['basic', 'combo', 'katakana', 'symbol'];

function SkillRow({ stat, label }: { stat: SkillStat; label: string }) {
  const { t } = useTranslation();
  const measuring = stat.samples < STATS_MIN_SAMPLES;
  const percent = Math.round(stat.accuracy * 100);
  const seconds = stat.medianMs === null ? null : (stat.medianMs / 1000).toFixed(1);
  return (
    <li className="skill-row">
      <div className="skill-line">
        <span className="skill-name">{label}</span>
        {measuring ? (
          <span className="skill-value is-muted">
            {t('stats.measuring', { samples: stat.samples, needed: STATS_MIN_SAMPLES })}
          </span>
        ) : (
          <span className="skill-value">
            <strong>{percent}%</strong>
            {seconds ? <span>{t('stats.perChar', { sec: seconds })}</span> : null}
          </span>
        )}
      </div>
      <div
        className="skill-bar"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={measuring ? undefined : percent}
        aria-valuetext={measuring ? t('stats.measuringShort') : `${percent}%`}
      >
        {measuring ? null : <span style={{ width: `${percent}%` }} />}
      </div>
    </li>
  );
}

/**
 * 가장 약한 규칙과 그 레벨: 표본이 충분하고 정확도가 90%보다 낮은 규칙 중 가장 낮은 것.
 * 그 레벨이 아직 잠겨 있으면(종합 테스트로만 친 규칙) 권하지 않는다
 */
function weakestBack(
  stats: readonly SkillStat[],
  label: (skill: SkillId) => string,
): WeakBack | undefined {
  const weakest = stats
    .filter((stat) => stat.samples >= STATS_MIN_SAMPLES && stat.accuracy < BACK_ACCURACY)
    .reduce<SkillStat | undefined>(
      (min, stat) => (!min || stat.accuracy < min.accuracy ? stat : min),
      undefined,
    );
  const level = weakest ? levelForSkill(weakest.skill) : undefined;
  if (!weakest || !level || !levelAccess().unlocked.has(level.id)) return undefined;
  return { name: label(weakest.skill), accuracy: weakest.accuracy, level };
}

/** 규칙(행·탁음·요음·가타카나 …)별 첫 시도 정확도와 속도, 자주 틀리는 글자, 오래 걸리는 글자 */
export function Stats({ repo }: { repo?: TrainingRepo }) {
  const { t } = useTranslation();
  const [attempts, setAttempts] = useState<AttemptRecord[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (repo ?? trainingRepo()).recentAttempts(RECENT_ATTEMPTS).then((list) => {
      if (alive) setAttempts(list);
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  const skillLabel = (skill: SkillId) => skillName(skill, t);

  const stats = attempts ? skillStats(attempts) : [];
  const pairs = attempts ? confusions(attempts) : [];
  const slow = attempts ? slowUnits(attempts) : [];
  const weak = attempts ? weakUnits(attempts) : [];
  const enough = stats.some((stat) => stat.samples >= STATS_MIN_SAMPLES);
  const back = weakestBack(stats, skillLabel);

  return (
    <main className="screen skill-screen" aria-busy={attempts === null}>
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('stats.title')}</h1>

      {/* 기록이 없어도 약점 연습 카드를 보여 처음 쓰는 사람도 이런 연습이 있는 줄 알게 한다 */}
      {attempts === null ? null : <WeakCard units={weak} back={back} enough={enough} />}
      {attempts === null ? null : stats.length === 0 ? (
        <p className="screen-body">{t('stats.empty')}</p>
      ) : (
        <>
          <p className="screen-body">{t('stats.lead')}</p>
          {STAGES.map((stage) => {
            const rows = stats.filter((stat) => stageOf(stat.skill) === stage);
            if (rows.length === 0) return null;
            return (
              <section key={stage}>
                <h2 className="section-label">{t(`course.stage.${stage}`)}</h2>
                <ul className="skill-list">
                  {rows.map((stat) => (
                    <SkillRow key={stat.skill} stat={stat} label={skillLabel(stat.skill)} />
                  ))}
                </ul>
              </section>
            );
          })}

          {pairs.length > 0 ? (
            <section>
              <h2 className="section-label">{t('stats.confusions')}</h2>
              <ul className="stat-pairs">
                {pairs.map(({ expected, actual, count }) => (
                  <li
                    key={`${expected}${actual}`}
                    aria-label={t('stats.confusionLabel', { expected, actual, count })}
                  >
                    <span className="stat-chars" lang="ja" aria-hidden="true">
                      {expected}
                      <span className="stat-arrow">→</span>
                      {actual}
                    </span>
                    <span className="stat-count" aria-hidden="true">
                      {t('stats.times', { count })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {slow.length > 0 ? (
            <section>
              <h2 className="section-label">{t('stats.slow')}</h2>
              <ul className="stat-pairs">
                {slow.map(({ unit, medianMs }) => (
                  <li key={unit}>
                    <span className="stat-chars" lang="ja">
                      {unit}
                    </span>
                    <span className="stat-count">
                      {t('result.seconds', { sec: (medianMs / 1000).toFixed(1) })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
