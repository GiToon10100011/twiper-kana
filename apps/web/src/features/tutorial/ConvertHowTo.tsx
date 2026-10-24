import { toHiragana } from '@twiper/core';
import type { KatakanaTopic } from '@twiper/content';
import { HowToSteps, spell } from './ModifierHowTo';

/** 규칙마다 보여 줄 예. 읽기는 단어에서 만든다 (カメラ → かめら) */
const EXAMPLES: Record<KatakanaTopic, readonly string[]> = {
  katakana: ['カメラ', 'キャベツ', 'ベッド'],
  longVowel: ['コーヒー', 'ゲーム'],
  foreign: ['ティ', 'ファ', 'シェ'],
  vu: ['ヴ', 'ヴァ', 'ヴォ'],
};

/** 읽기를 치는 순서까지 풀어 보여 줄 규칙: 작은 ァィゥェォ와 ゔ를 어떻게 만드는지가 요점이다 */
const SPELLED: ReadonlySet<KatakanaTopic> = new Set(['foreign', 'vu']);

/** 가타카나 레벨 준비 화면: 읽기를 히라가나로 친 다음 후보에서 가타카나를 고른다는 것을 보여 준다 */
export function ConvertHowTo({
  topic,
  label,
  candidateLabel,
}: {
  topic: KatakanaTopic;
  label: string;
  /** 후보 칸 앞에 붙일 말 (「후보」) */
  candidateLabel: string;
}) {
  return (
    <ol className="howto" aria-label={label} lang="ja">
      {EXAMPLES[topic].map((word) => (
        <li key={word}>
          {SPELLED.has(topic) ? (
            <HowToSteps steps={spell(toHiragana(word))} />
          ) : (
            <span className="howto-key">{toHiragana(word)}</span>
          )}
          <span className="howto-pick">
            <span className="howto-plus" aria-hidden="true">
              →
            </span>
            <span className="howto-note" lang="ko">
              {candidateLabel}
            </span>
            <span className="howto-key is-mod">{word}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
