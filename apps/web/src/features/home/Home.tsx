import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EXAM_MODES, examSource, findLevel, levels } from '@twiper/content';
import { createExam, type ExamMode } from '@twiper/core';
import { loadExamRecords, type ExamRecords } from '../../lib/examRecords';
import { ChartIcon, ForwardIcon, GearIcon, PlayIcon, TimerIcon } from '../../ui/icons';
import { EXAM_MINUTES, newExamSeed, type ExamMinutes } from '../exam/ExamRun';
import { levelAccess, type LevelAccess } from '../training/access';
import { levelName, levelSymbol } from '../training/levelTitle';

/** 알약 탭 묶음 (종목·시간 고르기) */
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

/**
 * 종합 테스트 패널 (시험지형). 종목과 시간을 고르면 그 종목의 첫 줄·기록·시작 버튼을 보여 준다.
 * 첫 줄은 시작할 때와 같은 씨앗으로 만들어, 보인 줄 그대로 테스트가 시작된다.
 */
function ExamPanel({ records }: { records: ExamRecords }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ExamMode>('kana');
  const [minutes, setMinutes] = useState<ExamMinutes>(1);
  const [seed] = useState(newExamSeed);
  const line = useMemo(() => createExam(examSource(mode), seed).line, [mode, seed]);
  const record = records[mode];
  const best = record?.best ?? null;
  const gaps = new Set(line.gapsAfter);

  return (
    <>
      <Pills
        label={t('tests.modes')}
        value={mode}
        options={EXAM_MODES.map((id) => [id, t(`tests.${id}`)] as const)}
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
            value={minutes}
            options={EXAM_MINUTES.map((min) => [min, t('tests.duration', { min })] as const)}
            onChange={setMinutes}
            small
          />
        </div>
        <p className="test-preview" lang="ja" aria-label={t('tests.preview')}>
          {Array.from(line.text).map((char, i) => (
            <span
              key={i}
              className={
                `${i === 0 ? 'is-next' : ''}${gaps.has(i) ? ' is-gap' : ''}`.trim() || undefined
              }
            >
              {char}
            </span>
          ))}
        </p>
        <dl className="stats test-stats">
          <div>
            <dt>{t('tests.bestSpeed')}</dt>
            <dd>
              {best ? Math.round(best.kpm) : '–'}
              <small>{t('tests.kpmUnit')}</small>
            </dd>
          </div>
          <div>
            <dt>{t('tests.accuracy')}</dt>
            <dd>{best ? `${Math.round(best.accuracy * 100)}%` : '–'}</dd>
          </div>
          <div>
            <dt>{t('tests.plays')}</dt>
            <dd>{t('tests.playsValue', { count: record?.plays ?? 0 })}</dd>
          </div>
        </dl>
        <Link
          className="btn btn-primary test-start"
          to={`/test/${mode}?min=${minutes}&seed=${seed}`}
        >
          <PlayIcon />
          {t('tests.start', { min: minutes })}
        </Link>
      </section>
    </>
  );
}

/** 단계별 익히기로 들어가는 줄. 아직 배울 레벨이 남았을 때만 마젠타로 강조한다 */
function StepsEntry({ access }: { access: LevelAccess }) {
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
        <Link className="tile-row" to="/steps">
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
 * 홈: 맨 위에 종합 테스트, 아직 칠 줄 모르는 사람을 위한 단계별 익히기는 그 아래.
 * top은 소개 문구 바로 아래에 둘 내용 (「오늘」 시안을 실제 홈 위에서 보기 위해)
 */
export function Home({ top }: { top?: ReactNode }) {
  const { t } = useTranslation();
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
      {top}

      <h2 className="section-label">{t('tests.title')}</h2>
      <ExamPanel records={loadExamRecords()} />
      <p className="section-note">{t('tests.note')}</p>

      <h2 className="section-label">{t('steps.section')}</h2>
      <StepsEntry access={levelAccess()} />
    </main>
  );
}
