import { charStatuses, type InputSessionState } from '@twiper/core';

interface TargetTextProps {
  session: InputSessionState;
  label?: string;
  /** 이 글자 위치 뒤에서 어절을 나눈다. 줄은 어절 경계에서만 바뀐다 */
  gapsAfter?: readonly number[];
}

/** 글자 위치를 어절로 묶는다: gapsAfter [3, 5] → [[0,1,2,3], [4,5], [6, …]] */
function wordsOf(length: number, gaps: ReadonlySet<number>): number[][] {
  const words: number[][] = [];
  let word: number[] = [];
  for (let i = 0; i < length; i += 1) {
    word.push(i);
    if (gaps.has(i)) {
      words.push(word);
      word = [];
    }
  }
  if (word.length > 0) words.push(word);
  return words;
}

/** 목표 문자열. 입력한 글자는 잉크색, 오타는 붉은색, 다음에 칠 글자는 마젠타 밑줄로 보여 준다. */
export function TargetText({ session, label, gapsAfter = [] }: TargetTextProps) {
  const statuses = charStatuses(session);
  const next = session.value.length;
  const char = (i: number) => (
    <span key={i} className={`ch-${statuses[i] ?? 'todo'}${i === next ? ' ch-next' : ''}`}>
      {session.target[i]}
    </span>
  );

  // 어절 경계가 없으면 글자마다 줄이 바뀔 수 있다 (기초 줄·단어). 있으면 어절을 통째로 넘긴다
  if (gapsAfter.length === 0) {
    return (
      <p className="target-text" lang="ja" aria-label={label}>
        {session.target.map((_, i) => char(i))}
      </p>
    );
  }
  return (
    <p className="target-text" lang="ja" aria-label={label}>
      {wordsOf(session.target.length, new Set(gapsAfter)).map((word) => (
        <span key={word[0]} className="ch-word">
          {word.map(char)}
        </span>
      ))}
    </p>
  );
}
