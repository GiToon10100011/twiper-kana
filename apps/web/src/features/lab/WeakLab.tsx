import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { levelForSkill } from '@twiper/content';
import type { WeakUnit } from '@twiper/core';
import { BackIcon } from '../../ui/icons';
import { Pills } from '../../ui/Pills';
import { skillName } from '../training/levelTitle';
import { WeakCard, WeakTile, type WeakBack } from '../weak/WeakEntry';

type ViewId = 'stats' | 'home';
type DataId = 'some' | 'none';

const VIEWS: readonly (readonly [ViewId, string])[] = [
  ['stats', 'A. 내 실력 맨 위'],
  ['home', 'B. 홈 타일'],
];

const DATA: readonly (readonly [DataId, string])[] = [
  ['some', '약점 있음'],
  ['none', '기록 부족'],
];

/** 약점 예시. 가짜 기록이며 저장하지 않는다. を는 틀리지 않았지만 느리다 */
const SAMPLE: readonly WeakUnit[] = [
  { unit: 'ぱ', samples: 12, missRate: 0.42, medianMs: 1300 },
  { unit: 'きゃ', samples: 9, missRate: 0.33, medianMs: 1700 },
  { unit: 'ね', samples: 15, missRate: 0.2, medianMs: 900 },
  { unit: 'ぢ', samples: 5, missRate: 0.2, medianMs: 2100 },
  { unit: 'を', samples: 8, missRate: 0, medianMs: 2400 },
];

/** 지금 화면의 다른 부분 (시안에서는 자리만 보인다) */
function Placeholder({ children }: { children: string }) {
  return <p className="lab-placeholder">{children}</p>;
}

/** 약점 연습으로 들어가는 자리 시안. 연습 화면은 지금의 레벨 연습과 같고 제목만 「약점 연습」이다 */
export function WeakLab() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewId>('stats');
  const [data, setData] = useState<DataId>('some');
  const units = data === 'some' ? SAMPLE : [];
  const level = levelForSkill('handakuten');
  const back: WeakBack | undefined =
    data === 'some' && level
      ? { name: skillName('handakuten', t), accuracy: 0.58, level }
      : undefined;

  return (
    <main className="lab">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>약점 연습 미리보기</span>
      </header>

      <div className="lab-choice">
        <span>자리</span>
        <Pills label="자리" value={view} options={VIEWS} onChange={setView} />
      </div>
      <div className="lab-choice">
        <span>기록</span>
        <Pills label="기록" value={data} options={DATA} onChange={setData} small />
      </div>

      {view === 'stats' ? (
        <section aria-label="내 실력 (예시)">
          <h1 className="screen-title">{t('stats.title')}</h1>
          <WeakCard units={units} back={back} />
          <Placeholder>
            규칙별 정확도 · 자주 틀리는 글자 · 오래 걸리는 글자 (지금 그대로)
          </Placeholder>
        </section>
      ) : (
        <section aria-label="홈 (예시)">
          <Placeholder>twiper. 소개 · 「오늘」 띠</Placeholder>
          <Placeholder>종합 테스트 (지금 그대로)</Placeholder>
          {units.length > 0 ? (
            <>
              <h2 className="section-label">{t('weak.title')}</h2>
              <WeakTile units={units} />
            </>
          ) : null}
          <Placeholder>처음이라면 · 단계별 익히기 (지금 그대로)</Placeholder>
        </section>
      )}
    </main>
  );
}
