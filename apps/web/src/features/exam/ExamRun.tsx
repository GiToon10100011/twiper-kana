import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { EXAM_MODES, examSource } from '@twiper/content';
import {
  advanceExam,
  attemptRecordOf,
  createExam,
  lineResultOf,
  partialLineResult,
  summarizeExam,
  type ExamMode,
  type ExamSummary,
  type InputSessionState,
  type LineResult,
} from '@twiper/core';
import { newId, trainingRepo } from '../../lib/db';
import { recordExam, type ExamBest } from '../../lib/examRecords';
import { BackIcon } from '../../ui/icons';
import { TrainingInput } from '../training/TrainingInput';

export const EXAM_MINUTES = [1, 3, 5] as const;
export type ExamMinutes = (typeof EXAM_MINUTES)[number];

export const newExamSeed = () => Math.floor(Math.random() * 2 ** 31);

const isMode = (value: string): value is ExamMode =>
  (EXAM_MODES as readonly string[]).includes(value);

/** 시도 기록에 남길 레벨 id. 통계(내 실력)가 레벨 기록과 함께 센다 */
const examLevelId = (mode: ExamMode) => `test-${mode}`;

/** 남은 시간 「0:42」 */
const clock = (ms: number) => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** /test/:mode?min=1&seed=… 홈에서 보인 첫 줄 그대로 시작하도록 씨앗을 받는다 */
export function ExamRoute() {
  const { mode = '' } = useParams();
  const [params] = useSearchParams();
  if (!isMode(mode)) return <Navigate to="/" replace />;
  const min = Number(params.get('min'));
  const minutes: ExamMinutes = (EXAM_MINUTES as readonly number[]).includes(min)
    ? (min as ExamMinutes)
    : 1;
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  return (
    <ExamRun
      key={`${mode}-${minutes}`}
      mode={mode}
      minutes={minutes}
      seed={Number.isFinite(seed) ? seed : undefined}
    />
  );
}

interface Outcome {
  summary: ExamSummary;
  isBest: boolean;
  previous: ExamBest | null;
}

/**
 * 종합 테스트 한 판. 첫 글자를 치는 순간부터 시간을 재고, 시간이 끝날 때까지 줄을 끝없이 낸다.
 * 실력 확인용이라 상황별 도움말은 띄우지 않는다.
 */
export function ExamRun({
  mode,
  minutes,
  seed,
}: {
  mode: ExamMode;
  minutes: ExamMinutes;
  seed?: number;
}) {
  const { t } = useTranslation();
  const name = t(`tests.${mode}`);
  const durationMs = minutes * 60_000;
  const [exam, setExam] = useState(() => createExam(examSource(mode), seed ?? newExamSeed()));
  const [lineNo, setLineNo] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const results = useRef<LineResult[]>([]);
  const latest = useRef<InputSessionState | null>(null);
  const shownAt = useRef(0);
  const sessionRef = useRef<{ id: string; startedAt: string } | null>(null);
  /** 이번 판을 끝냈는지. 화면이 다시 그려지기 전에 타이머가 한 번 더 돌아도 두 번 기록하지 않는다 */
  const finished = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onProgress = (session: InputSessionState) => {
    latest.current = session;
    if (startedAt !== null || session.startedAt === null) return;
    // 첫 글자를 친 순간부터 잰다. 입력 스냅샷과 같은 시계(performance.now)를 쓴다
    shownAt.current = session.startedAt;
    setStartedAt(session.startedAt);
    setNow(session.startedAt);
    const record = { id: newId(), startedAt: new Date().toISOString() };
    sessionRef.current = record;
    void trainingRepo().saveSession({
      ...record,
      levelId: examLevelId(mode),
      endedAt: null,
      summary: null,
    });
  };

  const onComplete = (session: InputSessionState) => {
    if (outcome) return;
    results.current.push(lineResultOf(session, shownAt.current));
    if (sessionRef.current) {
      const meta = {
        id: newId(),
        sessionId: sessionRef.current.id,
        levelId: examLevelId(mode),
        shownAt: shownAt.current,
        at: new Date(),
      };
      void trainingRepo().saveAttempt(attemptRecordOf(session, meta));
    }
    shownAt.current = session.completedAt ?? performance.now();
    latest.current = null;
    setExam((prev) => advanceExam(prev));
    setLineNo((n) => n + 1);
  };

  // 시간이 끝나면 치던 줄은 맞게 친 데까지만 세고 결과를 낸다
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const session = latest.current;
    const partial =
      session && session.completedAt === null ? partialLineResult(session, shownAt.current) : null;
    const summary = summarizeExam(results.current, partial, durationMs);
    const { isBest, previous } = recordExam(mode, summary, minutes);
    inputRef.current?.blur();
    setOutcome({ summary, isBest, previous });
    const record = sessionRef.current;
    if (record) {
      void trainingRepo().saveSession({
        ...record,
        levelId: examLevelId(mode),
        endedAt: new Date().toISOString(),
        summary,
      });
    }
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  useEffect(() => {
    if (startedAt === null || outcome) return;
    const timer = window.setInterval(() => {
      const time = performance.now();
      if (time - startedAt >= durationMs) finishRef.current();
      else setNow(time);
    }, 200);
    return () => window.clearInterval(timer);
  }, [startedAt, outcome, durationMs]);

  // 결과에서 다시 하기: iOS는 누른 그 순간에 포커스해야 키보드를 띄우므로 입력창을 동기로 그린 뒤 포커스한다
  const again = () => {
    results.current = [];
    finished.current = false;
    latest.current = null;
    sessionRef.current = null;
    flushSync(() => {
      setExam(createExam(examSource(mode), newExamSeed()));
      setLineNo(0);
      setStartedAt(null);
      setOutcome(null);
    });
    inputRef.current?.focus();
  };

  const remaining = startedAt === null ? durationMs : Math.max(0, durationMs - (now - startedAt));

  return (
    <main className="screen exam">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/" aria-label={t('drill.exit')}>
          <BackIcon />
        </Link>
        {outcome ? null : (
          <span className="exam-timer" role="timer" aria-label={t('exam.timer')}>
            {clock(remaining)}
          </span>
        )}
      </header>

      {outcome ? (
        <ExamResult name={name} minutes={minutes} outcome={outcome} onAgain={again} />
      ) : (
        <section>
          <h1 className="screen-title screen-title-small">
            {t('exam.title', { name })} · {t('tests.duration', { min: minutes })}
          </h1>
          <TrainingInput
            target={exam.line.text}
            questionKey={String(lineNo)}
            judge={exam.line.judge}
            gapsAfter={exam.line.gapsAfter}
            afterTarget={
              exam.upcoming ? (
                <p className="exam-upcoming" lang="ja" aria-label={t('exam.next')}>
                  {exam.upcoming.text}
                </p>
              ) : null
            }
            onComplete={onComplete}
            onProgress={onProgress}
            matchedHint={t('drill.matched')}
            convertHint={t('drill.convert', { word: exam.line.text })}
            fixHint={t('drill.fix', { word: exam.line.text })}
            placeholder={t('training.tapInput')}
            targetLabel={t('exam.title', { name })}
            inputRef={inputRef}
          />
          {startedAt === null ? <p className="screen-note">{t('exam.ready')}</p> : null}
        </section>
      )}
    </main>
  );
}

function ExamResult({
  name,
  minutes,
  outcome,
  onAgain,
}: {
  name: string;
  minutes: ExamMinutes;
  outcome: Outcome;
  onAgain: () => void;
}) {
  const { t } = useTranslation();
  const { summary, isBest, previous } = outcome;
  return (
    <section>
      <h1 className="screen-title">
        {t('exam.done', { name })} · {t('tests.duration', { min: minutes })}
      </h1>
      {isBest ? (
        <p className="exam-best is-new">{t('exam.newBest')}</p>
      ) : previous ? (
        <p className="exam-best">{t('exam.best', { kpm: Math.round(previous.kpm) })}</p>
      ) : null}
      <dl className="stats">
        <div>
          <dt>{t('result.speed')}</dt>
          <dd>{Math.round(summary.kpm)}</dd>
        </div>
        <div>
          <dt>{t('result.accuracy')}</dt>
          <dd>{Math.round(summary.accuracy * 100)}%</dd>
        </div>
        <div>
          <dt>{t('exam.lines')}</dt>
          <dd>{t('exam.linesValue', { count: summary.lines })}</dd>
        </div>
      </dl>

      <h2 className="section-label">{t('result.missed')}</h2>
      {summary.missed.length > 0 ? (
        <ul className="missed-list" lang="ja">
          {summary.missed.map(({ char, count }) => (
            <li key={char}>
              <span>{char}</span>
              <small>×{count}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="screen-body">{t('result.noMissed')}</p>
      )}

      {summary.romajiSuspected ? <p className="result-warning">{t('result.romaji')}</p> : null}
      {summary.toggleSuspected ? <p className="result-warning">{t('result.toggle')}</p> : null}

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          {t('result.again')}
        </button>
        <Link className="btn-quiet" to="/">
          {t('result.home')}
        </Link>
      </div>
    </section>
  );
}
