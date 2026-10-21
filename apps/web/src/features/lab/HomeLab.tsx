import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { findLevel, levels } from '@twiper/content';
import { isOnboarded } from '../../lib/flags';
import type { LevelRecord } from '../../lib/progress';
import { BackIcon, ChartIcon, ForwardIcon, GearIcon, PlayIcon, TimerIcon } from '../../ui/icons';
import { accessFor, type LevelAccess } from '../training/access';
import { CourseTiles } from '../training/CourseTiles';
import { levelName, levelSymbol } from '../training/levelTitle';

/** panel: 시험지형(종목 탭 + 패널 하나) / board: 기록판형(종목마다 최고 속도) */
type Layout = 'panel' | 'board';
type State = 'fresh' | 'midway' | 'allDone';
type TestId = 'kana' | 'word' | 'short' | 'long';
type TestRecord = { kpm: number; accuracy: number; plays: number };

/** 종합 테스트 4종. 미리보기는 시안용 첫 줄이다 */
const TESTS: readonly { id: TestId; preview: string }[] = [
  { id: 'kana', preview: 'ぬぴゃごッせ' },
  { id: 'word', preview: 'さくら' },
  { id: 'short', preview: 'あしたは はれです。' },
  { id: 'long', preview: 'むかし むかし、ある ところに おじいさんと' },
];

const DURATIONS = [1, 3, 5] as const;
type Duration = (typeof DURATIONS)[number];

const cleared = (bestAccuracy: number): LevelRecord => ({
  clearedAt: '2026-10-19T00:00:00.000Z',
  plays: 1,
  bestAccuracy,
  bestKpm: null,
});

/** 진행 예시. 가짜 기록이며 저장소에는 쓰지 않는다 */
const STATES: Record<
  State,
  { label: string; access: () => LevelAccess; records: Partial<Record<TestId, TestRecord>> }
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
      kana: { kpm: 132, accuracy: 0.97, plays: 12 },
      word: { kpm: 118, accuracy: 0.95, plays: 7 },
      short: { kpm: 96, accuracy: 0.93, plays: 3 },
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
  const layout: Layout = params.get('layout') === 'board' ? 'board' : 'panel';
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

/** 알약 탭 묶음. 시안 설정과 종목·시간 고르기에 같이 쓴다 */
function Pills<T extends string | number>({
  label,
  value,
  options,
  onChange,
  small = false,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`stage-tabs${small ? ' is-small' : ''}`} role="group" aria-label={label}>
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
  );
}

/** 시험지형: 종목을 고르면 그 종목의 첫 줄·기록·시작 버튼을 패널 하나에 보여 준다 */
function TestPanel({
  records,
  duration,
  onDuration,
  onStart,
}: {
  records: Partial<Record<TestId, TestRecord>>;
  duration: Duration;
  onDuration: (value: Duration) => void;
  onStart: (id: TestId) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<TestId>('kana');
  const test = TESTS.find((item) => item.id === mode) ?? TESTS[0];
  const record = records[mode];
  if (!test) return null;

  return (
    <>
      <Pills
        label={t('tests.modes')}
        value={mode}
        options={TESTS.map((item) => [item.id, t(`tests.${item.id}`)] as const)}
        onChange={setMode}
      />
      <section className="test-panel" aria-label={t(`tests.${mode}`)}>
        <div className="test-panel-top">
          <span className="test-tags">
            <TimerIcon />
            {t('tests.noHelp')} · {t('tests.endless')}
          </span>
          <Pills
            label={t('tests.durationLabel')}
            value={duration}
            options={DURATIONS.map((min) => [min, t('tests.duration', { min })] as const)}
            onChange={onDuration}
            small
          />
        </div>
        <p className="test-preview" lang="ja" aria-label={t('tests.preview')}>
          {Array.from(test.preview).map((char, i) => (
            <span key={i} className={i === 0 ? 'is-next' : undefined}>
              {char}
            </span>
          ))}
        </p>
        <dl className="stats test-stats">
          <div>
            <dt>{t('tests.bestSpeed')}</dt>
            <dd>
              {record ? record.kpm : '–'}
              <small>{t('tests.kpmUnit')}</small>
            </dd>
          </div>
          <div>
            <dt>{t('tests.accuracy')}</dt>
            <dd>{record ? `${Math.round(record.accuracy * 100)}%` : '–'}</dd>
          </div>
          <div>
            <dt>{t('tests.plays')}</dt>
            <dd>{t('tests.playsValue', { count: record?.plays ?? 0 })}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn-primary test-start" onClick={() => onStart(mode)}>
          <PlayIcon />
          {t('tests.start', { min: duration })}
        </button>
      </section>
    </>
  );
}

/** 기록판형: 네 종목을 점수판처럼 줄 세우고 최고 속도를 크게 보여 준다. 줄을 누르면 시작 */
function TestBoard({
  records,
  duration,
  onDuration,
  onStart,
}: {
  records: Partial<Record<TestId, TestRecord>>;
  duration: Duration;
  onDuration: (value: Duration) => void;
  onStart: (id: TestId) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="test-board-top">
        <span className="test-tags">
          <TimerIcon />
          {t('tests.noHelp')} · {t('tests.endless')}
        </span>
        <Pills
          label={t('tests.durationLabel')}
          value={duration}
          options={DURATIONS.map((min) => [min, t('tests.duration', { min })] as const)}
          onChange={onDuration}
          small
        />
      </div>
      <ol className="test-board">
        {TESTS.map((test) => {
          const record = records[test.id];
          return (
            <li key={test.id}>
              <button type="button" className="test-board-row" onClick={() => onStart(test.id)}>
                <span className="test-board-name">
                  <strong>{t(`tests.${test.id}`)}</strong>
                  <small lang="ja">{test.preview}</small>
                </span>
                <span className="test-board-score">
                  <strong>{record ? record.kpm : '–'}</strong>
                  <small>
                    {record
                      ? `${t('tests.kpmUnit')} · ${Math.round(record.accuracy * 100)}%`
                      : t('tests.none')}
                  </small>
                </span>
                <PlayIcon />
              </button>
            </li>
          );
        })}
      </ol>
    </>
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
  // 이어서 할 레벨의 대표 글자. 다 끝냈으면 ✓
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
 * 새 홈 시안 (/lab/home-v2): 맨 위에 종합 테스트, 그 아래 단계별 익히기.
 * 테스트는 아직 만들기 전이라 시작해도 열리지 않는다. 가짜 기록은 저장하지 않는다.
 */
export function HomeLab() {
  const { t } = useTranslation();
  const { state, layout, set, query } = useLabParams();
  const [duration, setDuration] = useState<Duration>(1);
  const [started, setStarted] = useState<TestId | null>(null);
  const sample = STATES[state];
  const access = sample.access();
  const testProps = {
    records: sample.records,
    duration,
    onDuration: setDuration,
    onStart: setStarted,
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
      {layout === 'panel' ? <TestPanel {...testProps} /> : <TestBoard {...testProps} />}
      <p className="section-note">{t('tests.note')}</p>
      {started ? (
        <p className="lab-message" role="status">
          {t('tests.pending', { name: t(`tests.${started}`), min: duration })}
        </p>
      ) : null}

      <h2 className="section-label">{t('steps.section')}</h2>
      <StepsEntry access={access} to={`/lab/home-v2/steps?${query}`} />

      <section className="lab-panel" aria-label="시안 설정">
        <h2 className="section-label">시안 설정 (검수용, 실제 홈에는 없음)</h2>
        <div className="lab-choice">
          <span>배치</span>
          <Pills
            label="배치"
            value={layout}
            options={[
              ['panel', 'A. 시험지형'],
              ['board', 'B. 기록판형'],
            ]}
            onChange={(value) => set('layout', value)}
          />
        </div>
        <div className="lab-choice">
          <span>진행 예시</span>
          <Pills
            label="진행 예시"
            value={state}
            options={(Object.keys(STATES) as State[]).map(
              (key) => [key, STATES[key].label] as const,
            )}
            onChange={(value) => set('state', value)}
          />
        </div>
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
