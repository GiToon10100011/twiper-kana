import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import {
  findLevel,
  iosKana,
  nextLevel,
  type KatakanaTopic,
  type Level,
  type LevelTopic,
  type SymbolTopic,
} from '@twiper/content';
import {
  advanceDrill,
  attemptRecordOf,
  createDrill,
  helpIndex,
  lineResultOf,
  lookupChar,
  missCounts,
  rubySurface,
  summarizeDrill,
  type DrillSummary,
  type FlickDirection,
  type InputError,
  type InputSessionState,
} from '@twiper/core';
import { newId, trainingRepo } from '../../lib/db';
import { recordLevel } from '../../lib/progress';
import { loadSettings } from '../../lib/settings';
import { BackIcon } from '../../ui/icons';
import { ConvertHowTo } from '../tutorial/ConvertHowTo';
import { FlickDiagram } from '../tutorial/FlickDiagram';
import { ModifierHowTo } from '../tutorial/ModifierHowTo';
import { levelAccess } from './access';
import { DrillResult } from './DrillResult';
import { HelpCard } from './HelpCard';
import { levelTitle } from './levelTitle';
import { TrainingInput } from './TrainingInput';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** 탭하면 char가 나오는 키. かな 자판에 없으면 ☆123 자판에서 찾는다 (0 키 등) */
const keyOf = (char: string) =>
  [iosKana.layers.kana, iosKana.layers.number]
    .flatMap((layer) => layer.keys)
    .find((key) => key.outputs.tap === char);

const KATAKANA_TOPICS: ReadonlySet<LevelTopic> = new Set<KatakanaTopic>([
  'katakana',
  'longVowel',
  'foreign',
  'vu',
]);

const isKatakanaTopic = (topic: LevelTopic): topic is KatakanaTopic => KATAKANA_TOPICS.has(topic);

const SYMBOL_TOPICS: ReadonlySet<LevelTopic> = new Set<SymbolTopic>(['punct', 'symbol']);

const isSymbolTopic = (topic: LevelTopic): topic is SymbolTopic => SYMBOL_TOPICS.has(topic);

/**
 * 준비 화면 안내문: 짧은 문장 / 채팅 / 가타카나 단어 / 기호를 붙인 짧은 말 / 단어만 / 50음+단어 /
 * 조합+단어 / 글자 줄
 */
function introKey(
  level: Level,
):
  | 'drill.introSentence'
  | 'drill.introChat'
  | 'drill.introKatakana'
  | 'drill.introPhrase'
  | 'drill.introWords'
  | 'drill.introAll'
  | 'drill.introCombo'
  | 'drill.intro' {
  if (level.kind === 'sentence') return 'drill.introSentence';
  if (level.kind === 'chat') return 'drill.introChat';
  if (level.kind === 'word') return 'drill.introKatakana';
  if (level.kind === 'phrase') return 'drill.introPhrase';
  const hasWords = (level.drill.words?.length ?? 0) > 0;
  if (hasWords && level.drill.focus.length === 0) return 'drill.introWords';
  if (hasWords) return level.kind === 'all' ? 'drill.introAll' : 'drill.introCombo';
  return 'drill.intro';
}

/** 한 레벨의 줄 드릴: 준비 → 줄마다 입력하고 確定 → 결과 */
export function Drill({ level }: { level: Level }) {
  const { t } = useTranslation();
  const title = levelTitle(level, t);
  const [started, setStarted] = useState(false);
  const [drill, setDrill] = useState(() => createDrill(level.drill, newSeed()));
  const [{ helpIdleMs }] = useState(loadSettings);
  const shownAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 지금 판의 세션 기록 */
  const sessionRef = useRef<{ id: string; startedAt: string } | null>(null);
  /** 같은 레벨의 지난 판 요약. undefined: 아직 모름 / null: 처음 */
  const [previous, setPrevious] = useState<DrillSummary | null | undefined>(undefined);
  /** 이번 판에 끝낸 줄의 오류. 같은 글자를 여러 번 틀렸는지 보고 도움말을 띄운다 */
  const [pastErrors, setPastErrors] = useState<readonly InputError[]>([]);

  // iOS는 사용자가 누른 그 순간에 포커스해야 키보드를 띄우므로 입력창을 동기로 그린 뒤 포커스한다.
  const start = () => {
    flushSync(() => {
      setDrill(createDrill(level.drill, newSeed()));
      setPastErrors([]);
      setStarted(true);
    });
    shownAt.current = performance.now();
    inputRef.current?.focus();

    const session = { id: newId(), startedAt: new Date().toISOString() };
    sessionRef.current = session;
    setPrevious(undefined);
    void trainingRepo().saveSession({
      ...session,
      levelId: level.id,
      endedAt: null,
      summary: null,
    });
  };

  const onComplete = (session: InputSessionState) => {
    const result = lineResultOf(session, shownAt.current);
    if (sessionRef.current) {
      const meta = {
        id: newId(),
        sessionId: sessionRef.current.id,
        levelId: level.id,
        shownAt: shownAt.current,
        at: new Date(),
      };
      void trainingRepo().saveAttempt(attemptRecordOf(session, meta));
    }
    // 다음 줄은 確定 직후에 나타난다. 같은 시계(스냅샷 시각)로 재야 반응 시간이 맞는다.
    shownAt.current = session.completedAt ?? performance.now();
    setDrill((prev) => advanceDrill(prev, result));
    setPastErrors((prev) => [...prev, ...session.errors]);
  };

  // 끝까지 푼 레벨을 기록해 다음 레벨을 열고, 세션 요약을 저장한 뒤 지난 판과 비교할 기록을 읽는다.
  // 같은 드릴을 두 번 기록하지 않는다.
  const recorded = useRef<typeof drill | null>(null);
  useEffect(() => {
    if (!drill.done || recorded.current === drill) return;
    recorded.current = drill;
    const summary = summarizeDrill(drill.results);
    recordLevel(level.id, summary);

    const session = sessionRef.current;
    if (!session) return;
    const repo = trainingRepo();
    void repo
      .saveSession({
        ...session,
        levelId: level.id,
        endedAt: new Date().toISOString(),
        summary,
      })
      .then(() => repo.finishedSessions(level.id, 2))
      .then((sessions) => {
        if (sessionRef.current?.id !== session.id) return;
        setPrevious(sessions.find((s) => s.id !== session.id)?.summary ?? null);
      });
  }, [drill, level.id]);

  // 키보드를 바꾸거나 플릭으로 치기 시작하면 거둔다 (결과 화면에는 그런 줄이 있었다고 남는다)
  const notice = (session: InputSessionState) => {
    if (session.romajiActive) return t('training.romaji');
    if (session.toggleActive) return t('training.toggle');
    return null;
  };

  const labels: Record<FlickDirection, string> = {
    tap: t('onboarding.flick.tap'),
    left: t('onboarding.flick.left'),
    up: t('onboarding.flick.up'),
    right: t('onboarding.flick.right'),
    down: t('onboarding.flick.down'),
  };

  // 다음 글자에서 머뭇거리거나 이번 판에 여러 번 틀린 글자에 오면 치는 법을 보여 준다.
  // 기호는 ☆123 자판에서도 찾는다.
  const help = (session: InputSessionState, stuckAt: number | null) => {
    const misses = missCounts([...pastErrors, ...session.errors]);
    const index = helpIndex(session, { stuckAt, misses });
    const char = index === null ? undefined : session.target[index];
    const steps = char === undefined ? null : lookupChar(iosKana, char);
    return char && steps ? <HelpCard char={char} steps={steps} labels={labels} /> : null;
  };

  const { lineCount } = level.drill;
  const current = drill.results.length + 1;
  const progress =
    current > lineCount ? t('drill.extra') : t('drill.progress', { current, total: lineCount });

  // 문장은 길어서 안내에 전체를 되풀이하지 않고 밑줄 친 곳을 가리킨다
  const isSentence = level.stage === 'sentence';
  const word = rubySurface(drill.line);
  const partner = level.chat?.find((line) => line.reply === drill.line)?.partner;

  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('drill.exit')}>
          <BackIcon />
        </Link>
        {started && !drill.done ? <span>{progress}</span> : null}
      </header>

      {!started ? (
        <section>
          <h1 className="screen-title" lang="ja">
            {title}
          </h1>
          <p className="screen-body">
            {t(introKey(level), { count: lineCount, length: level.drill.lineLength })}
          </p>
          {level.assessment ? <p className="screen-body">{t('drill.noHelp')}</p> : null}
          {level.topic ? (
            <>
              <p className="screen-body">{t(`drill.howTo.${level.topic}`)}</p>
              {isKatakanaTopic(level.topic) ? (
                <ConvertHowTo
                  topic={level.topic}
                  label={t('drill.keyGuide')}
                  candidateLabel={t('drill.candidate')}
                />
              ) : isSymbolTopic(level.topic) ? null : (
                <ModifierHowTo topic={level.topic} label={t('drill.keyGuide')} />
              )}
            </>
          ) : null}
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
          previous={previous}
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
            judge={level.drill.judge}
            onComplete={onComplete}
            matchedHint={t('drill.matched')}
            convertHint={isSentence ? t('drill.convertMarked') : t('drill.convert', { word })}
            fixHint={isSentence ? t('drill.fixMarked') : t('drill.fix', { word })}
            notice={notice}
            help={level.assessment ? undefined : help}
            idleMs={helpIdleMs}
            layout={isSentence ? (level.kind === 'chat' ? 'chat' : 'sentence') : undefined}
            partner={partner}
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
  if (!level || !levelAccess().unlocked.has(level.id)) return <Navigate to="/steps" replace />;
  return <Drill key={level.id} level={level} />;
}
