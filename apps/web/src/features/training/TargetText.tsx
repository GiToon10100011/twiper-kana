import { charStatuses, type CharStatus, type InputSessionState } from '@twiper/core';

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

type Piece =
  | { kind: 'char'; index: number }
  | { kind: 'ruby'; surface: string; indexes: number[]; status: CharStatus };

/** 한자 표기 하나의 상태: 변환함 / 읽기까지 쳐서 후보를 고를 차례 / 읽기 그대로 確定해 버림 / 아직 */
function rubyStatus(converted: boolean, read: boolean, composing: boolean): CharStatus {
  if (converted) return 'correct';
  if (!read) return 'todo';
  return composing ? 'pending' : 'wrong';
}

/**
 * 목표를 가나 글자와 한자 표기 조각으로 나눈다.
 * 한자는 그 한자로 바꿔야 맞다. 읽기만 친 자리는 밑줄로 표시하고(안내는 입력창 아래), 틀린 읽기 글자는 후리가나에 보인다
 */
function piecesOf(session: InputSessionState, statuses: readonly CharStatus[]): Piece[] {
  const pieces: Piece[] = [];
  let i = 0;
  session.rubies.forEach((ruby, n) => {
    for (; i < ruby.start; i += 1) pieces.push({ kind: 'char', index: i });
    const indexes = Array.from({ length: ruby.end - ruby.start }, (_, k) => ruby.start + k);
    const read = indexes.every((index) => statuses[index] === 'correct');
    const status = rubyStatus(session.converted[n] === true, read, session.composing);
    pieces.push({ kind: 'ruby', surface: ruby.surface, indexes, status });
    i = ruby.end;
  });
  for (; i < session.target.length; i += 1) pieces.push({ kind: 'char', index: i });
  return pieces;
}

/**
 * 목표 문자열. 입력한 글자는 잉크색, 오타는 붉은색, 다음에 칠 글자는 마젠타 밑줄로 보여 준다.
 * 한자 표기는 한자를 크게, 칠 읽기를 그 위에 작게(후리가나) 보이고 치는 진행은 읽기 글자에 표시한다
 * (2026-10-25 /lab/ruby 시안 중 A 채택). 그 한자로 바꿔 確定해야 맞다.
 */
export function TargetText({ session, label, gapsAfter = [] }: TargetTextProps) {
  const statuses = charStatuses(session);
  const next = session.value.length;
  const char = (i: number) => (
    <span key={i} className={`ch-${statuses[i] ?? 'todo'}${i === next ? ' ch-next' : ''}`}>
      {session.target[i]}
    </span>
  );

  if (session.rubies.length > 0) {
    return (
      <p className="target-text" lang="ja" aria-label={label}>
        {piecesOf(session, statuses).map((piece) =>
          piece.kind === 'ruby' ? (
            <ruby key={piece.indexes[0]} className={`ch-ruby ch-${piece.status}`}>
              {piece.surface}
              <rt>{piece.indexes.map(char)}</rt>
            </ruby>
          ) : (
            char(piece.index)
          ),
        )}
      </p>
    );
  }

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
