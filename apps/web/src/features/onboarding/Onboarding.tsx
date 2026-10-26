import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { iosKana } from '@twiper/content';
import type { FlickDirection, InputSessionState } from '@twiper/core';
import { markOnboarded } from '../../lib/flags';
import { TrainingInput } from '../training/TrainingInput';
import { FlickDiagram } from '../tutorial/FlickDiagram';
import { KeyboardKeys } from '../tutorial/KeyboardKeys';
import { LayoutTour, VowelTour } from '../tutorial/tours';

type Step = 'setup' | 'flick' | 'try' | 'layout' | 'vowels' | 'check' | 'keys' | 'done';
type TypingStep = 'try' | 'check';

const STEPS: readonly Step[] = [
  'setup',
  'flick',
  'try',
  'layout',
  'vowels',
  'check',
  'keys',
  'done',
];
/** try: 같은 키, 다섯 방향 / check: 다른 키, 같은 방향(왼쪽 = い단) */
const PRACTICE: Record<TypingStep, string> = { try: 'あいうえお', check: 'きしちにひ' };
const A_KEY = iosKana.layers.kana.keys.find((key) => key.id === 'a');

/**
 * 튜토리얼 (Part 0–3). 홈에서 언제든 다시 볼 수 있다.
 * 키보드 준비 → 플릭의 개념 → 직접 입력하며 確定 후 넘어가는 규칙 익히기
 * → 12키 배치(50음 순서) → 방향 = 모음 → 다른 키를 같은 방향으로 쳐 보기 → 글자 키 말고 다른 키들.
 */
export function Onboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('setup');
  const inputRef = useRef<HTMLInputElement>(null);

  const finish = () => {
    markOnboarded();
    setStep('done');
  };

  // 버튼을 누른 그 순간에 입력창에 포커스해야 iOS가 키보드를 띄운다.
  const startTyping = (next: TypingStep) => {
    flushSync(() => setStep(next));
    inputRef.current?.focus();
  };

  const labels: Record<FlickDirection, string> = {
    tap: t('onboarding.flick.tap'),
    left: t('onboarding.flick.left'),
    up: t('onboarding.flick.up'),
    right: t('onboarding.flick.right'),
    down: t('onboarding.flick.down'),
  };

  // 키보드를 바꾸거나 플릭으로 치기 시작하면 거둔다
  const notice = (session: InputSessionState) => {
    if (session.romajiActive) return t('training.romaji');
    if (session.toggleActive) return t('training.toggle');
    return null;
  };

  return (
    <main className="screen">
      <header className="screen-header">
        <span>
          {t('onboarding.step', { current: STEPS.indexOf(step) + 1, total: STEPS.length })}
        </span>
        {step !== 'done' ? (
          <button type="button" className="btn-quiet" onClick={finish}>
            {t('onboarding.skip')}
          </button>
        ) : null}
      </header>

      {step === 'setup' ? (
        <section>
          <h1 className="screen-title">{t('onboarding.setup.title')}</h1>
          <p className="screen-body">{t('onboarding.setup.body')}</p>
          <ol className="checklist">
            <li>{t('onboarding.setup.add')}</li>
            <li>{t('onboarding.setup.switch')}</li>
          </ol>
          <button type="button" className="btn btn-primary" onClick={() => setStep('flick')}>
            {t('onboarding.setup.done')}
          </button>
        </section>
      ) : null}

      {step === 'flick' ? (
        <section>
          <h1 className="screen-title">{t('onboarding.flick.title')}</h1>
          <p className="screen-body">{t('onboarding.flick.body')}</p>
          {A_KEY ? <FlickDiagram keyDef={A_KEY} labels={labels} /> : null}
          <p className="screen-body">{t('onboarding.flick.rule')}</p>
          <button type="button" className="btn btn-primary" onClick={() => startTyping('try')}>
            {t('onboarding.flick.tryIt')}
          </button>
        </section>
      ) : null}

      {step === 'layout' ? (
        <section>
          <h1 className="screen-title">{t('onboarding.layout.title')}</h1>
          <p className="screen-body">{t('onboarding.layout.body')}</p>
          <LayoutTour label={t('onboarding.layout.title')} />
          <p className="screen-note">{t('onboarding.layout.modifier')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setStep('vowels')}>
            {t('onboarding.layout.next')}
          </button>
        </section>
      ) : null}

      {step === 'vowels' ? (
        <section>
          <h1 className="screen-title">{t('onboarding.vowels.title')}</h1>
          <p className="screen-body">{t('onboarding.vowels.body')}</p>
          <VowelTour
            legend={{
              tap: t('onboarding.vowels.legend.tap'),
              left: t('onboarding.vowels.legend.left'),
              up: t('onboarding.vowels.legend.up'),
              right: t('onboarding.vowels.legend.right'),
              down: t('onboarding.vowels.legend.down'),
            }}
            label={t('onboarding.vowels.title')}
          />
          <p className="screen-note">{t('onboarding.vowels.exception')}</p>
          <button type="button" className="btn btn-primary" onClick={() => startTyping('check')}>
            {t('onboarding.vowels.tryIt')}
          </button>
        </section>
      ) : null}

      {step === 'try' || step === 'check' ? (
        <section>
          <h1 className="screen-title">{t(`onboarding.${step}.title`)}</h1>
          <p className="screen-body">{t(`onboarding.${step}.hint`)}</p>
          <TrainingInput
            target={PRACTICE[step]}
            questionKey={step}
            onComplete={() => setStep(step === 'try' ? 'layout' : 'keys')}
            matchedHint={t('onboarding.matched')}
            notice={notice}
            placeholder={t('training.tapInput')}
            targetLabel={t(`onboarding.${step}.title`)}
            inputRef={inputRef}
          />
          <p className="screen-note">{t('onboarding.commitRule')}</p>
        </section>
      ) : null}

      {step === 'keys' ? (
        <section>
          <h1 className="screen-title">{t('keys.title')}</h1>
          <p className="screen-body">{t('keys.lead')}</p>
          <KeyboardKeys />
          <button type="button" className="btn btn-primary" onClick={finish}>
            {t('keys.next')}
          </button>
        </section>
      ) : null}

      {step === 'done' ? (
        <section>
          <h1 className="screen-title">{t('onboarding.done.title')}</h1>
          <p className="screen-body">{t('onboarding.done.body')}</p>
          <div className="actions">
            <Link className="btn btn-primary" to="/train/L1">
              {t('onboarding.done.start')}
            </Link>
            <Link className="btn-quiet" to="/steps">
              {t('onboarding.done.steps')}
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
