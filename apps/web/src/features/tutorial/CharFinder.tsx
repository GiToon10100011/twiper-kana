import { Fragment, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { charTables, iosKana, type CharTableId } from '@twiper/content';
import {
  explainText,
  toHiragana,
  type FlickDirection,
  type InputStep,
  type TextPart,
} from '@twiper/core';
import { FlickDiagram } from './FlickDiagram';

/** 붙여 넣은 글이 길 때 보여 줄 소리 단위 수 */
const MAX_PARTS = 20;

type Labels = Record<FlickDirection, string>;

/** 한 글자를 치는 동작: (다른 자판이면 그 자판) + 키 도해 + 「小゛゜」 횟수 = 나오는 글자 */
function CharSteps({ steps, labels }: { steps: readonly InputStep[]; labels: Labels }) {
  const { t } = useTranslation();
  const keyStep = steps.find((step) => step.kind === 'key');
  const modStep = steps.find((step) => step.kind === 'modifier');
  const layer = keyStep ? iosKana.layers[keyStep.layer] : undefined;
  const keyDef = keyStep && layer?.keys.find((key) => key.id === keyStep.keyId);
  if (!keyStep || !layer || !keyDef) return null;

  const out = steps[steps.length - 1]?.out ?? keyStep.out;
  const description = [
    keyStep.layer === 'kana' ? null : t('find.layer', { label: layer.switchLabel }),
    t('help.key', { key: keyStep.label, dir: labels[keyStep.dir] }),
    modStep ? t('help.modifier', { label: iosKana.modifier.label, times: modStep.times }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="find-steps" aria-hidden="true">
        {keyStep.layer === 'kana' ? null : (
          <>
            <span className="howto-key is-layer">{layer.switchLabel}</span>
            <span className="howto-plus">›</span>
          </>
        )}
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
          {out}
        </strong>
      </div>
      <p className="find-desc">{description}</p>
    </>
  );
}

/** 이어진 가타카나 묶음 (コーヒーと人々 → コーヒー). 장음 ー는 가타카나 뒤에 올 때만 묶음에 넣는다 */
function katakanaRuns(parts: readonly TextPart[]): string[] {
  const runs: string[] = [];
  let run = '';
  for (const part of parts) {
    if (part.convert || (run !== '' && part.text === 'ー')) {
      run += part.text;
    } else if (run !== '') {
      runs.push(run);
      run = '';
    }
  }
  return run === '' ? runs : [...runs, run];
}

/** 글을 소리 단위로 나눠 치는 법을 보여 준다. 가타카나·한자·다른 자판 안내는 끝에 한 번만 붙인다 */
function HowToType({ text, labels }: { text: string; labels: Labels }) {
  const { t } = useTranslation();
  const all = explainText(iosKana, text);
  const parts = all.slice(0, MAX_PARTS);
  if (parts.length === 0) return null;

  const chars = parts.flatMap((part) => part.chars);
  const runs = katakanaRuns(parts);
  const notes = [
    runs.length > 0
      ? t('find.convert', { pairs: runs.map((run) => `${toHiragana(run)} → ${run}`).join(', ') })
      : null,
    chars.some((c) => c.steps === null) ? t('find.missing') : null,
    chars.some((c) => c.steps?.[0]?.kind === 'key' && c.steps[0].layer !== 'kana')
      ? t('find.layerNote')
      : null,
    all.length > MAX_PARTS ? t('find.more', { count: MAX_PARTS }) : null,
  ].filter((note): note is string => note !== null);

  return (
    <section className="find-result" aria-label={t('help.title', { char: text.trim() })}>
      <ol className="find-parts">
        {parts.map((part, i) => (
          <li key={`${i}-${part.text}`} className="find-part">
            <span className="find-part-text" lang="ja">
              {part.text}
            </span>
            <div>
              {part.chars.map(({ char, steps }, j) => (
                <div key={`${j}-${char}`} className="find-char">
                  {steps ? (
                    <CharSteps steps={steps} labels={labels} />
                  ) : (
                    <p className="find-desc">{t('find.notOnKeys')}</p>
                  )}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {notes.map((note) => (
        <p key={note} className="find-note">
          {note}
        </p>
      ))}
    </section>
  );
}

/**
 * 글자 찾기 (「이 글자 어떻게 쳐요?」): 붙여 넣은 글이나 표에서 고른 글자를
 * 어느 키를 어느 방향으로 치는지 보여 준다. 설명용이며 입력을 채점하지 않는다.
 */
export function CharFinder() {
  const { t } = useTranslation();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [tableId, setTableId] = useState<CharTableId>('basic');
  const [picked, setPicked] = useState<string | null>(null);
  const table = charTables.find((candidate) => candidate.id === tableId) ?? charTables[0];

  const labels: Labels = {
    tap: t('onboarding.flick.tap'),
    left: t('onboarding.flick.left'),
    up: t('onboarding.flick.up'),
    right: t('onboarding.flick.right'),
    down: t('onboarding.flick.down'),
  };

  const changeTable = (next: CharTableId) => {
    setTableId(next);
    setPicked(null);
  };

  return (
    <div className="char-finder">
      <label className="visually-hidden" htmlFor={inputId}>
        {t('find.input')}
      </label>
      <input
        id={inputId}
        className="text-input find-input"
        type="text"
        lang="ja"
        value={query}
        placeholder={t('find.placeholder')}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        onChange={(event) => setQuery(event.target.value)}
      />
      <HowToType text={query} labels={labels} />

      <h2 className="section-label">{t('find.tables')}</h2>
      <div className="stage-tabs is-small" role="group" aria-label={t('find.tables')}>
        {charTables.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="stage-tab"
            aria-pressed={candidate.id === tableId}
            onClick={() => changeTable(candidate.id)}
          >
            {t(`find.table.${candidate.id}`)}
          </button>
        ))}
      </div>
      <div className="find-table" role="group" aria-label={t(`find.table.${tableId}`)}>
        {table?.rows.map((row) => (
          <Fragment key={row.join('')}>
            <div className="find-row">
              {row.map((cell) => (
                <button
                  key={cell}
                  type="button"
                  className="find-cell"
                  lang="ja"
                  aria-pressed={picked === cell}
                  onClick={() => setPicked((current) => (current === cell ? null : cell))}
                >
                  {cell}
                </button>
              ))}
            </div>
            {picked !== null && row.includes(picked) ? (
              <HowToType text={picked} labels={labels} />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
