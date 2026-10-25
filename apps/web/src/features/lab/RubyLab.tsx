import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  createInputSession,
  pendingStep,
  reduceInputSession,
  rubySurface,
  type InputSessionState,
} from '@twiper/core';
import { BackIcon } from '../../ui/icons';
import { Pills } from '../../ui/Pills';
import { TargetText, type RubyStyle } from '../training/TargetText';

type SampleId = 'word' | 'sentence';
type StateId = 'typing' | 'read' | 'converted' | 'committed' | 'unconverted';

/** 입력창 값 열 (조합 중이면 true) */
type Steps = readonly (readonly [string, boolean])[];

/** 예시 목표와 상태마다 그때까지 들어온 입력. 가짜 입력이며 저장하지 않는다 */
const SAMPLES: Record<SampleId, { label: string; target: string; states: Record<StateId, Steps> }> =
  {
    word: {
      label: '단어 時々',
      target: '{時々|ときどき}',
      states: {
        typing: [
          ['と', true],
          ['とき', true],
        ],
        read: [['ときどき', true]],
        converted: [
          ['ときどき', true],
          ['時々', true],
        ],
        committed: [
          ['ときどき', true],
          ['時々', false],
        ],
        unconverted: [
          ['ときどき', true],
          ['ときどき', false],
        ],
      },
    },
    sentence: {
      label: '짧은 글 今日は雨です',
      target: '{今日|きょう}は{雨|あめ}です',
      states: {
        typing: [['きょうは', true]],
        read: [['きょうはあめです', true]],
        converted: [
          ['きょうはあめです', true],
          ['今日は雨です', true],
        ],
        committed: [
          ['今日は雨です', true],
          ['今日は雨です', false],
        ],
        unconverted: [
          ['きょうはあめです', true],
          ['きょうはあめです', false],
        ],
      },
    },
  };

const SAMPLE_OPTIONS = Object.entries(SAMPLES).map(
  ([id, { label }]) => [id as SampleId, label] as const,
);

const STATES: readonly (readonly [StateId, string])[] = [
  ['typing', '읽기 치는 중'],
  ['read', '읽기 다 침'],
  ['converted', '후보 고름'],
  ['committed', '確定'],
  ['unconverted', '변환 안 하고 確定'],
];

const STYLES: readonly { style: RubyStyle; title: string; note: string }[] = [
  { style: 'above', title: 'A. 후리가나', note: '한자를 크게, 읽기를 그 위에 작게' },
  { style: 'lines', title: 'B. 읽기 크게', note: '지금처럼 읽기를 크게, 바꿀 한자는 위 작은 줄' },
];

function sessionOf(target: string, steps: Steps): InputSessionState {
  return steps.reduce(
    (session, [value, composing], i) =>
      reduceInputSession(session, { t: (i + 1) * 100, value, composing }),
    createInputSession(target, 'commit'),
  );
}

/** 한자 표기({今日|きょう})를 연습 화면에 어떻게 보일지 두 시안을 같은 입력 상태로 비교한다 */
export function RubyLab() {
  const { t } = useTranslation();
  const [sample, setSample] = useState<SampleId>('word');
  const [state, setState] = useState<StateId>('read');
  const { target, states } = SAMPLES[sample];
  const session = sessionOf(target, states[state]);
  const word = rubySurface(target);
  const step = pendingStep(session);
  const hintClass = step === 'fix' ? ' is-warning' : step ? ' is-matched' : '';
  const hint =
    session.completedAt !== null
      ? '(다음 문제로 넘어감)'
      : step === 'convert'
        ? t('drill.convert', { word })
        : step === 'fix'
          ? t('drill.fix', { word })
          : step === 'commit'
            ? t('drill.matched')
            : '';

  return (
    <main className="lab">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('settings.home')}>
          <BackIcon />
        </Link>
        <span>한자 표기 미리보기</span>
      </header>

      <div className="lab-choice">
        <span>예시</span>
        <Pills label="예시" value={sample} options={SAMPLE_OPTIONS} onChange={setSample} />
      </div>
      <div className="lab-choice">
        <span>입력 상태</span>
        <Pills label="입력 상태" value={state} options={STATES} onChange={setState} small />
      </div>

      {STYLES.map(({ style, title, note }) => (
        <section key={style} className="ruby-sample" aria-label={title}>
          <h2 className="section-label">
            {title} · {note}
          </h2>
          <div className="trainer">
            <TargetText session={session} rubyStyle={style} />
            <input
              className="text-input"
              type="text"
              lang="ja"
              readOnly
              value={session.raw.join('')}
              aria-label="입력창 (예시)"
            />
            <p className={`trainer-hint${hintClass}`}>{hint}</p>
          </div>
        </section>
      ))}
    </main>
  );
}
