import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const WORD = 'twiper';

const START_MS = 200;
const TYPE_MS = 80;
const DOT_MS = START_MS + WORD.length * TYPE_MS + 120;
const LEAVE_MS = DOT_MS + 800;
const FADE_MS = 300;
const REDUCED_LEAVE_MS = 700;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * 앱을 열 때 한 번 나오는 짧은 오프닝 (약 1.8초).
 * 워드마크를 타이핑하듯 쓰고, 끝의 마젠타 점이 키를 누른 듯 퍼지며 소개 문구가 나온다. 누르면 바로 넘어간다.
 */
export function Opening({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  const [reduced] = useState(prefersReducedMotion);
  const [typed, setTyped] = useState(reduced ? WORD.length : 0);
  const [dot, setDot] = useState(reduced);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduced) {
      for (let i = 1; i <= WORD.length; i += 1) {
        timers.push(setTimeout(() => setTyped(i), START_MS + i * TYPE_MS));
      }
      timers.push(setTimeout(() => setDot(true), DOT_MS));
    }
    timers.push(setTimeout(() => setLeaving(true), reduced ? REDUCED_LEAVE_MS : LEAVE_MS));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(onFinish, reduced ? 0 : FADE_MS);
    return () => clearTimeout(timer);
  }, [leaving, reduced, onFinish]);

  return (
    <div
      className={`opening${leaving ? ' is-leaving' : ''}`}
      onPointerDown={() => setLeaving(true)}
      data-testid="opening"
    >
      <p className="opening-mark" aria-label={`${WORD}.`}>
        <span aria-hidden="true">{WORD.slice(0, typed)}</span>
        {dot ? null : <span className="opening-caret" aria-hidden="true" />}
        <span className="opening-rest" aria-hidden="true">
          {WORD.slice(typed)}
        </span>
        <span className={`opening-dot${dot ? ' is-shown' : ''}`} aria-hidden="true">
          .
        </span>
      </p>
      <p className={`opening-lead${dot ? ' is-shown' : ''}`}>{t('home.lead')}</p>
    </div>
  );
}
