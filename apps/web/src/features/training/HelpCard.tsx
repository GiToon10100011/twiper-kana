import { useTranslation } from 'react-i18next';
import { iosKana } from '@twiper/content';
import type { FlickDirection, InputStep } from '@twiper/core';
import { FlickDiagram } from '../tutorial/FlickDiagram';

interface HelpCardProps {
  /** 막힌 목표 글자 */
  char: string;
  /** 그 글자를 치는 동작 (explainChar) */
  steps: readonly InputStep[];
  labels: Record<FlickDirection, string>;
}

/**
 * 상황별 도움말: 막힌 글자를 어느 키로 어느 방향에 치고, 「小゛゜」를 몇 번 누르는지 보여 준다.
 * 키보드가 화면 아래를 덮으므로 입력창 바로 아래에 작게 띄운다.
 */
export function HelpCard({ char, steps, labels }: HelpCardProps) {
  const { t } = useTranslation();
  const keyStep = steps.find((step) => step.kind === 'key');
  const modStep = steps.find((step) => step.kind === 'modifier');
  const keyDef = keyStep && iosKana.layers.kana.keys.find((key) => key.id === keyStep.keyId);
  if (!keyStep || !keyDef) return null;

  const reading = steps[steps.length - 1]?.out ?? char;
  const description = [
    t('help.key', { key: keyStep.label, dir: labels[keyStep.dir] }),
    modStep ? t('help.modifier', { label: iosKana.modifier.label, times: modStep.times }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <aside className="help-card" aria-label={t('help.title', { char })}>
      <p className="help-title">{t('help.title', { char })}</p>
      <p className="visually-hidden">{description}</p>
      <div className="help-steps" aria-hidden="true">
        <FlickDiagram keyDef={keyDef} labels={labels} active={keyStep.dir} compact />
        {modStep ? (
          <>
            <span className="howto-plus">+</span>
            <span className="howto-key is-mod" lang="ja">
              {iosKana.modifier.label}
              {modStep.times > 1 ? <small>×{modStep.times}</small> : null}
            </span>
          </>
        ) : null}
        <span className="howto-eq">=</span>
        <strong className="howto-out" lang="ja">
          {reading}
        </strong>
      </div>
      {reading !== char ? <p className="help-note">{t('help.reading', { reading })}</p> : null}
    </aside>
  );
}
