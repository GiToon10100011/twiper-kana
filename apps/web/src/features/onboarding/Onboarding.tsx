import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { iosKana } from '@twiper/content';
import type { FlickDirection, InputSessionState } from '@twiper/core';
import { markOnboarded } from '../../lib/flags';
import { TrainingInput } from '../training/TrainingInput';
import { FlickDiagram } from '../tutorial/FlickDiagram';

type Step = 'setup' | 'flick' | 'try' | 'check' | 'done';

const STEPS: readonly Step[] = ['setup', 'flick', 'try', 'check', 'done'];
const PRACTICE = { try: 'あいうえお', check: 'かきくけこ' } as const;
const A_KEY = iosKana.layers.kana.keys.find((key) => key.id === 'a');

/**
 * 첫 실행 안내 (Tutorial Part 0).
 * 키보드 준비 → 플릭의 개념 → 직접 입력해 보며 確定 후 다음으로 넘어가는 규칙 익히기 → 키보드 확인.
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
  const startPractice = () => {
    flushSync(() => setStep('try'));
    inputRef.current?.focus();
  };

  const labels: Record<FlickDirection, string> = {
    tap: t('onboarding.flick.tap'),
    left: t('onboarding.flick.left'),
    up: t('onboarding.flick.up'),
    right: t('onboarding.flick.right'),
    down: t('onboarding.flick.down'),
  };

  const notice = (session: InputSessionState) => {
    if (session.romajiSuspected) return t('training.romaji');
    if (session.toggleSuspected) return t('training.toggle');
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
          <button type="button" className="btn btn-primary" onClick={startPractice}>
            {t('onboarding.flick.tryIt')}
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
            onComplete={() => (step === 'try' ? setStep('check') : finish())}
            matchedHint={t('onboarding.matched')}
            notice={notice}
            placeholder={t('training.tapInput')}
            targetLabel={t(`onboarding.${step}.title`)}
            inputRef={inputRef}
          />
          <p className="screen-note">{t('onboarding.commitRule')}</p>
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
            <Link className="btn-quiet" to="/">
              {t('onboarding.done.home')}
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
