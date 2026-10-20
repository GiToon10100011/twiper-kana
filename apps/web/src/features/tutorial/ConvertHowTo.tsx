import { toHiragana } from '@twiper/core';
import type { KatakanaTopic } from '@twiper/content';

/** 규칙마다 보여 줄 예. 읽기는 단어에서 만든다 (カメラ → かめら) */
const EXAMPLES: Record<KatakanaTopic, readonly string[]> = {
  katakana: ['カメラ', 'キャベツ', 'ベッド'],
  longVowel: ['コーヒー', 'ゲーム'],
};

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
          <span className="howto-key">{toHiragana(word)}</span>
          <span className="howto-plus" aria-hidden="true">
            →
          </span>
          <span className="howto-note" lang="ko">
            {candidateLabel}
          </span>
          <span className="howto-key is-mod">{word}</span>
        </li>
      ))}
    </ol>
  );
}
