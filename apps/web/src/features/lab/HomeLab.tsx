import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { findLevel, levels } from '@twiper/content';
import { isOnboarded } from '../../lib/flags';
import type { LevelRecord } from '../../lib/progress';
import { BackIcon, ChartIcon, ForwardIcon, GearIcon } from '../../ui/icons';
import { accessFor, type LevelAccess } from '../training/access';
import { CourseTiles } from '../training/CourseTiles';
import { levelName, levelSymbol } from '../training/levelTitle';

type Layout = 'grid' | 'list';
type State = 'fresh' | 'midway' | 'allDone';
type TestId = 'kana' | 'word' | 'short' | 'long';

/** 종합 테스트 4종. 타일 글자와 카드에 보일 예시는 시안용이다 */
const TESTS: readonly { id: TestId; mark: string; sample: string }[] = [
  { id: 'kana', mark: 'あ', sample: 'か ぴ ゃ ッ ー' },
  { id: 'word', mark: '単語', sample: 'さくら・カメラ' },
  { id: 'short', mark: '短文', sample: 'あしたは はれです。' },
  { id: 'long', mark: '長文', sample: 'むかし むかし、ある ところに…' },
];

const cleared = (bestAccuracy: number): LevelRecord => ({
  clearedAt: '2026-10-19T00:00:00.000Z',
  plays: 1,
  bestAccuracy,
  bestKpm: null,
});

/** 진행 예시. 가짜 기록이며 저장소에는 쓰지 않는다 */
const STATES: Record<
  State,
  {
    label: string;
    access: () => LevelAccess;
    records: Partial<Record<TestId, { kpm: number; accuracy: number }>>;
  }
> = {
  fresh: { label: '처음', access: () => accessFor({}), records: {} },
  midway: {
    label: 'Lv.4 차례',
    access: () => accessFor({ L1: cleared(0.98), L2: cleared(0.93), L3: cleared(0.86) }),
    records: {},
  },
  allDone: {
    label: '모두 끝냄',
    access: () =>
      accessFor(
        Object.fromEntries(levels.map((level, i) => [level.id, cleared(0.8 + (i % 5) * 0.04)])),
      ),
    records: {
      kana: { kpm: 132, accuracy: 0.97 },
      word: { kpm: 118, accuracy: 0.95 },
      short: { kpm: 96, accuracy: 0.93 },
    },
  },
};

const isState = (value: string | null): value is State =>
  value === 'fresh' || value === 'midway' || value === 'allDone';

/** 시안 상태는 주소에 둔다. 단계별 익히기 시안으로 갔다 와도 같은 예시를 본다 */
function useLabParams() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('state');
  const state: State = isState(raw) ? raw : 'midway';
  const layout: Layout = params.get('layout') === 'list' ? 'list' : 'grid';
  const set = (key: 'state' | 'layout', value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  return { state, layout, set, query: params.toString() };
}

function LabChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
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

/** 단계별 익히기로 들어가는 줄. 아직 배울 레벨이 남았을 때만 마젠타로 강조한다 */
function StepsEntry({ access, to }: { access: LevelAccess; to: string }) {
  const { t } = useTranslation();
  const current = access.current ? findLevel(access.current) : undefined;
  const fresh = Object.keys(access.progress).length === 0;
  const status = fresh
    ? t('steps.start')
    : current
      ? t('steps.continue', { number: current.number, name: levelName(current, t) })
      : t('steps.done', { count: levels.length });
  // 이어서 할 레벨의 대표 글자. 다 끝냈으면 글자 테스트의 「あ」와 겹치지 않게 ✓
  const symbol = current ? levelSymbol(current) : '\u{2713}';
  return (
    <ul className="tile-list">
      <li className={`tile-item${current ? ' is-current' : ''}`}>
        <Link className="tile-row" to={to}>
          <span
            className={`tile-mark${Array.from(symbol).length > 1 ? ' is-long' : ''}`}
            lang="ja"
            aria-hidden="true"
          >
            {symbol}
          </span>
          <span className="tile-body">
            <span className="tile-title">{t('steps.title')}</span>
            <span className="tile-meta">{t('steps.hint', { last: levels.length })}</span>
            <span className="tile-status">{status}</span>
          </span>
          <ForwardIcon />
        </Link>
      </li>
    </ul>
  );
}

/**
 * 새 홈 시안 (/lab/home-v2): 맨 위에 종합 테스트 4종, 그 아래 단계별 익히기.
 * 테스트는 아직 만들기 전이라 눌러도 열리지 않는다. 가짜 기록은 저장하지 않는다.
 */
export function HomeLab() {
  const { t } = useTranslation();
  const { state, layout, set, query } = useLabParams();
  const [tapped, setTapped] = useState<TestId | null>(null);
  const sample = STATES[state];
  const access = sample.access();

  const record = (id: TestId) => {
    const best = sample.records[id];
    return best
      ? t('tests.best', { kpm: best.kpm, accuracy: Math.round(best.accuracy * 100) })
      : t('tests.none');
  };

  return (
    <main className="home">
      <nav className="home-actions">
        <Link className="icon-btn" to="/stats" aria-label={t('home.stats')}>
          <ChartIcon />
        </Link>
        <Link className="icon-btn" to="/settings" aria-label={t('home.settings')}>
          <GearIcon />
        </Link>
      </nav>
      <h1 className="wordmark">
        twiper<span aria-hidden="true">.</span>
      </h1>
      <p className="lead">{t('home.lead')}</p>

      <h2 className="section-label">{t('tests.title')}</h2>
      {layout === 'grid' ? (
        <ul className="test-grid">
          {TESTS.map((test) => (
            <li key={test.id}>
              <button type="button" className="test-card" onClick={() => setTapped(test.id)}>
                <span className="test-name">{t(`tests.${test.id}`)}</span>
                <span className="test-sample" lang="ja">
                  {test.sample}
                </span>
                <span className="test-record">{record(test.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="tile-list">
          {TESTS.map((test) => (
            <li key={test.id} className="tile-item">
              <button type="button" className="tile-row" onClick={() => setTapped(test.id)}>
                <span
                  className={`tile-mark${Array.from(test.mark).length > 1 ? ' is-long' : ''}`}
                  lang="ja"
                  aria-hidden="true"
                >
                  {test.mark}
                </span>
                <span className="tile-body">
                  <span className="tile-title">{t(`tests.${test.id}`)}</span>
                  <span className="tile-meta">{t(`tests.${test.id}Hint`)}</span>
                  <span className="tile-status">{record(test.id)}</span>
                </span>
                <ForwardIcon />
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="section-note">{t('tests.note')}</p>
      {tapped ? (
        <p className="lab-message" role="status">
          시안: 「{t(`tests.${tapped}`)}」 테스트는 아직 만들기 전이라 열리지 않아요.
        </p>
      ) : null}

      <h2 className="section-label">{t('steps.section')}</h2>
      <StepsEntry access={access} to={`/lab/home-v2/steps?${query}`} />

      <section className="lab-panel" aria-label="시안 설정">
        <h2 className="section-label">시안 설정 (검수용, 실제 홈에는 없음)</h2>
        <LabChoice
          label="배치"
          value={layout}
          options={[
            ['grid', '카드 2×2'],
            ['list', '목록'],
          ]}
          onChange={(value) => set('layout', value)}
        />
        <LabChoice
          label="진행 예시"
          value={state}
          options={(Object.keys(STATES) as State[]).map((key) => [key, STATES[key].label] as const)}
          onChange={(value) => set('state', value)}
        />
        <p className="lab-message">
          <Link to="/">지금 홈으로 돌아가기</Link>
        </p>
      </section>
    </main>
  );
}

/** 단계별 익히기 시안 (/lab/home-v2/steps): 지금 홈의 튜토리얼과 코스 목록을 옮긴 페이지 */
export function StepsLab() {
  const { t } = useTranslation();
  const { state, query } = useLabParams();
  const access = STATES[state].access();

  return (
    <main className="screen">
      <header className="screen-header">
        <Link
          className="icon-btn header-back"
          to={`/lab/home-v2?${query}`}
          aria-label={t('settings.home')}
        >
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('steps.title')}</h1>
      <p className="screen-body">{t('steps.lead')}</p>

      <ul className="nav-list home-tutorial">
        <li>
          <Link to="/tutorial">
            <span>{t('home.tutorial')}</span>
            <small>{isOnboarded() ? t('home.tutorialHint') : t('home.tutorialFirst')}</small>
          </Link>
        </li>
      </ul>

      <h2 className="section-label">{t('course.title')}</h2>
      <CourseTiles key={state} access={access} />
    </main>
  );
}
