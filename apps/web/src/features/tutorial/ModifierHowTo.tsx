import { Fragment } from 'react';
import { iosKana, type ComboTopic } from '@twiper/content';

type Step = { kind: 'key'; char: string } | { kind: 'mod'; times: number };

const { modifier } = iosKana;

/** base를 친 뒤 「小゛゜」를 몇 번 눌러야 target이 되는지 (iOS 순환 데이터, 실기 확인됨) */
function timesFor(base: string, target: string): number {
  const cycle = modifier.cycles.find((c) => c.chars[0] === base);
  const times = cycle?.chars.indexOf(target) ?? -1;
  if (times < 1) throw new Error(`「小゛゜」로 ${base}에서 ${target}을 만들 수 없다`);
  return times;
}

const key = (char: string): Step => ({ kind: 'key', char });
const mod = (base: string, target: string): Step => ({
  kind: 'mod',
  times: timesFor(base, target),
});

/** 규칙마다 보여 줄 입력 순서 예 */
const EXAMPLES: Record<ComboTopic, readonly { steps: readonly Step[]; out: string }[]> = {
  dakuten: [
    { steps: [key('か'), mod('か', 'が')], out: 'が' },
    { steps: [key('さ'), mod('さ', 'ざ')], out: 'ざ' },
    { steps: [key('は'), mod('は', 'ば')], out: 'ば' },
  ],
  handakuten: [
    { steps: [key('は'), mod('は', 'ぱ')], out: 'ぱ' },
    { steps: [key('ふ'), mod('ふ', 'ぷ')], out: 'ぷ' },
  ],
  small: [
    { steps: [key('あ'), mod('あ', 'ぁ')], out: 'ぁ' },
    { steps: [key('や'), mod('や', 'ゃ')], out: 'ゃ' },
    { steps: [key('つ'), mod('つ', 'っ')], out: 'っ' },
  ],
  yoon: [
    { steps: [key('き'), key('や'), mod('や', 'ゃ')], out: 'きゃ' },
    { steps: [key('き'), mod('き', 'ぎ'), key('よ'), mod('よ', 'ょ')], out: 'ぎょ' },
  ],
  sokuon: [{ steps: [key('き'), key('つ'), mod('つ', 'っ'), key('て')], out: 'きって' }],
};

/** 조합 레벨 준비 화면: 「小゛゜」를 언제, 몇 번 누르는지 보여 준다 */
export function ModifierHowTo({ topic, label }: { topic: ComboTopic; label: string }) {
  return (
    <ol className="howto" aria-label={label} lang="ja">
      {EXAMPLES[topic].map(({ steps, out }) => (
        <li key={out}>
          {steps.map((step, i) => (
            <Fragment key={i}>
              {i > 0 ? (
                <span className="howto-plus" aria-hidden="true">
                  +
                </span>
              ) : null}
              {step.kind === 'key' ? (
                <span className="howto-key">{step.char}</span>
              ) : (
                <span className="howto-key is-mod">
                  {modifier.label}
                  {step.times > 1 ? <small>×{step.times}</small> : null}
                </span>
              )}
            </Fragment>
          ))}
          <span className="howto-eq" aria-hidden="true">
            =
          </span>
          <strong className="howto-out">{out}</strong>
        </li>
      ))}
    </ol>
  );
}
