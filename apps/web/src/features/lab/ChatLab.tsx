import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  createInputSession,
  parseRuby,
  pendingStep,
  reduceInputSession,
  type InputSessionState,
} from '@twiper/core';
import { BackIcon } from '../../ui/icons';
import { Pills } from '../../ui/Pills';
import { TargetText } from '../training/TargetText';

type ViewId = 'sentence' | 'chatA' | 'chatB';
type StateId = 'start' | 'typing' | 'done' | 'unconverted';

/** 상태마다 입력창에 들어와 있는 값 (조합 중이면 true). 가짜 입력이며 저장하지 않는다 */
type Steps = readonly (readonly [string, boolean])[];

const SENTENCE = '{今日|きょう}は{天気|てんき}がいいですね。';
const PARTNER = '{週末|しゅうまつ}、{何|なに}してた？';
const REPLY = '{友達|ともだち}とカフェに{行|い}ったよ！';

const STEPS: Record<'sentence' | 'chat', Record<StateId, Steps>> = {
  sentence: {
    start: [],
    typing: [['きょうはてんきが', true]],
    done: [['きょうはてんきがいいですね。', true]],
    unconverted: [
      ['きょうはてんきがいいですね。', true],
      ['きょうはてんきがいいですね。', false],
    ],
  },
  chat: {
    start: [],
    // 가타카나(カフェ)는 아직 바꾸지 않았다: 읽기는 맞으므로 진행으로 보인다
    typing: [['ともだちとかふぇ', true]],
    done: [['友達とカフェに行ったよ！', true]],
    unconverted: [
      ['ともだちとかふぇにいったよ！', true],
      ['ともだちとかふぇにいったよ！', false],
    ],
  },
};

const VIEWS: readonly (readonly [ViewId, string])[] = [
  ['sentence', '짧은 문장'],
  ['chatA', '채팅 A'],
  ['chatB', '채팅 B'],
];

const STATES: readonly (readonly [StateId, string])[] = [
  ['start', '처음'],
  ['typing', '치는 중'],
  ['done', '다 침'],
  ['unconverted', '히라가나로 確定'],
];

const NOTES: Record<ViewId, string> = {
  sentence: '후리가나가 붙은 문장. 지금 연습 화면에서 글자 크기만 줄였다',
  chatA: '상대 말풍선(왼쪽) + 내 말풍선(오른쪽) 안에 칠 문장',
  chatB: '상대 말풍선 + 내 답은 지금 연습 화면처럼 크게',
};

function sessionOf(target: string, steps: Steps): InputSessionState {
  return steps.reduce(
    (session, [value, composing], i) =>
      reduceInputSession(session, { t: (i + 1) * 100, value, composing }),
    createInputSession(target, 'commit'),
  );
}

/** 읽기만 보여 주는 한자 표기 (상대 말풍선). 진행 색 없이 한자 위에 읽기를 작게 붙인다 */
function Furigana({ text }: { text: string }) {
  const { chars, rubies } = parseRuby(text);
  const parts: ReactNode[] = [];
  let i = 0;
  for (const ruby of rubies) {
    parts.push(chars.slice(i, ruby.start).join(''));
    parts.push(
      <ruby key={ruby.start}>
        {ruby.surface}
        <rt>{chars.slice(ruby.start, ruby.end).join('')}</rt>
      </ruby>,
    );
    i = ruby.end;
  }
  parts.push(chars.slice(i).join(''));
  return <>{parts}</>;
}

/** 문장 연습과 채팅 연습 화면 시안. 같은 입력 상태로 비교한다 */
export function ChatLab() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewId>('chatA');
  const [state, setState] = useState<StateId>('typing');
  const target = view === 'sentence' ? SENTENCE : REPLY;
  const session = sessionOf(target, STEPS[view === 'sentence' ? 'sentence' : 'chat'][state]);
  const step = pendingStep(session);
  // 문장은 길어서 전체를 되풀이하지 않고 밑줄 친 곳을 가리킨다
  const hint =
    step === 'convert'
      ? t('drill.convertMarked')
      : step === 'fix'
        ? t('drill.fixMarked')
        : step === 'commit'
          ? t('drill.matched')
          : '';

  const input = (
    <>
      <input
        className="text-input"
        type="text"
        lang="ja"
        readOnly
        value={session.raw.join('')}
        placeholder={t('training.tapInput')}
        aria-label="입력창 (예시)"
      />
      <p className={`trainer-hint${step === 'fix' ? ' is-warning' : step ? ' is-matched' : ''}`}>
        {hint}
      </p>
    </>
  );

  return (
    <main className="lab">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>문장·채팅 미리보기</span>
      </header>

      <div className="lab-choice">
        <span>화면</span>
        <Pills label="화면" value={view} options={VIEWS} onChange={setView} />
      </div>
      <div className="lab-choice">
        <span>입력 상태</span>
        <Pills label="입력 상태" value={state} options={STATES} onChange={setState} small />
      </div>
      <p className="lab-note">{NOTES[view]}</p>

      <section className="lab-screen" aria-label="연습 화면 (예시)">
        <h1 className="screen-title screen-title-small" lang="ja">
          {view === 'sentence' ? 'Lv.22 짧은 문장' : 'Lv.23 채팅'}
        </h1>
        {view === 'sentence' ? (
          <div className="trainer is-sentence">
            <TargetText session={session} />
            {input}
          </div>
        ) : (
          <div className={`trainer chat${view === 'chatA' ? ' is-bubbles' : ''}`}>
            <p className="chat-bubble is-partner" lang="ja">
              <Furigana text={PARTNER} />
            </p>
            {view === 'chatA' ? (
              <div className="chat-bubble is-me">
                <TargetText session={session} />
              </div>
            ) : (
              <TargetText session={session} />
            )}
            {input}
          </div>
        )}
      </section>
    </main>
  );
}
