import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import { findLevel, iosKana, nextLevel, type Level } from '@twiper/content';
import {
  advanceDrill,
  createDrill,
  lineResultOf,
  summarizeDrill,
  type FlickDirection,
  type InputSessionState,
} from '@twiper/core';
import { recordLevel } from '../../lib/progress';
import { FlickDiagram } from '../tutorial/FlickDiagram';
import { levelAccess } from './access';
import { DrillResult } from './DrillResult';
import { levelTitle } from './levelTitle';
import { TrainingInput } from './TrainingInput';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const keyOf = (char: string) => iosKana.layers.kana.keys.find((key) => key.outputs.tap === char);

/** 한 레벨의 줄 드릴: 준비 → 줄마다 입력하고 確定 → 결과 */
export function Drill({ level }: { level: Level }) {
  const { t } = useTranslation();
  const title = levelTitle(level, t);
  const [started, setStarted] = useState(false);
  const [drill, setDrill] = useState(() => createDrill(level.drill, newSeed()));
  const shownAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // iOS는 사용자가 누른 그 순간에 포커스해야 키보드를 띄우므로 입력창을 동기로 그린 뒤 포커스한다.
  const start = () => {
    flushSync(() => {
      setDrill(createDrill(level.drill, newSeed()));
      setStarted(true);
    });
    shownAt.current = performance.now();
    inputRef.current?.focus();
  };

  const onComplete = (session: InputSessionState) => {
    const result = lineResultOf(session, shownAt.current);
    // 다음 줄은 確定 직후에 나타난다. 같은 시계(스냅샷 시각)로 재야 반응 시간이 맞는다.
    shownAt.current = session.completedAt ?? performance.now();
    setDrill((prev) => advanceDrill(prev, result));
  };

  // 끝까지 푼 레벨을 기록해 다음 레벨을 연다. 같은 드릴을 두 번 기록하지 않는다.
  const recorded = useRef<typeof drill | null>(null);
  useEffect(() => {
    if (!drill.done || recorded.current === drill) return;
    recorded.current = drill;
    recordLevel(level.id, summarizeDrill(drill.results));
  }, [drill, level.id]);

  const notice = (session: InputSessionState) => {
    if (session.romajiSuspected) return t('training.romaji');
    if (session.toggleSuspected) return t('training.toggle');
    return null;
  };

  const labels: Record<FlickDirection, string> = {
    tap: t('onboarding.flick.tap'),
    left: t('onboarding.flick.left'),
    up: t('onboarding.flick.up'),
    right: t('onboarding.flick.right'),
    down: t('onboarding.flick.down'),
  };

  const { lineCount } = level.drill;
  const current = drill.results.length + 1;
  const progress =
    current > lineCount ? t('drill.extra') : t('drill.progress', { current, total: lineCount });

  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="btn-quiet" to="/">
          {t('drill.exit')}
        </Link>
        {started && !drill.done ? <span>{progress}</span> : null}
      </header>

      {!started ? (
        <section>
          <h1 className="screen-title" lang="ja">
            {title}
          </h1>
          <p className="screen-body">
            {t(level.kind === 'all' ? 'drill.introAll' : 'drill.intro', { count: lineCount })}
          </p>
          {level.keys.length > 0 ? (
            <div
              className={`key-guide${level.keys.length > 1 ? ' is-multi' : ''}`}
              aria-label={t('drill.keyGuide')}
            >
              {level.keys.map((char) => {
                const key = keyOf(char);
                return key ? <FlickDiagram key={char} keyDef={key} labels={labels} /> : null;
              })}
            </div>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={start}>
            {t('drill.start')}
          </button>
        </section>
      ) : drill.done ? (
        <DrillResult
          title={title}
          summary={summarizeDrill(drill.results)}
          next={nextLevel(level.id)}
          onAgain={start}
        />
      ) : (
        <section>
          <h1 className="screen-title screen-title-small" lang="ja">
            {title}
          </h1>
          <TrainingInput
            target={drill.line}
            questionKey={String(drill.results.length)}
            onComplete={onComplete}
            matchedHint={t('drill.matched')}
            notice={notice}
            placeholder={t('training.tapInput')}
            targetLabel={title}
            inputRef={inputRef}
          />
          <p className="screen-note">{t('drill.retryNote')}</p>
        </section>
      )}
    </main>
  );
}

/** /train/:levelId. 없거나 잠긴 레벨이면 홈으로. 레벨이 바뀌면 상태를 새로 시작하도록 key를 준다 */
export function DrillRoute() {
  const { levelId = '' } = useParams();
  const level = findLevel(levelId);
  if (!level || !levelAccess().unlocked.has(level.id)) return <Navigate to="/" replace />;
  return <Drill key={level.id} level={level} />;
}
