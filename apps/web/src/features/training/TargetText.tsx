import { charStatuses, type CharStatus, type InputSessionState } from '@twiper/core';

interface TargetTextProps {
  session: InputSessionState;
  label?: string;
  /** 이 글자 위치 뒤에서 어절을 나눈다. 줄은 어절 경계에서만 바뀐다 */
  gapsAfter?: readonly number[];
}

type Piece =
  | { kind: 'char'; index: number }
  | { kind: 'ruby'; surface: string; indexes: number[]; status: CharStatus };

/** 줄 첫머리에 오면 안 되는 닫는 기호. 앞 글자와 묶어 함께 줄을 넘긴다 */
const NO_LINE_START = new Set(Array.from('、。，．！？!?」』）〕】…'));

const keyOf = (piece: Piece) => (piece.kind === 'ruby' ? (piece.indexes[0] ?? 0) : piece.index);

const lastIndexOf = (piece: Piece) =>
  piece.kind === 'ruby' ? (piece.indexes[piece.indexes.length - 1] ?? 0) : piece.index;

/**
 * 조각을 어절로 묶는다: gapsAfter [3, 5] → [[0,1,2,3], [4,5], [6, …]].
 * 틈은 읽기로 펼친 글자 위치라서 한자 표기({今日|きょう}는 0–2)는 마지막 읽기 자리로 본다
 */
function wordsOf(pieces: readonly Piece[], gaps: ReadonlySet<number>): Piece[][] {
  const words: Piece[][] = [];
  let word: Piece[] = [];
  for (const piece of pieces) {
    word.push(piece);
    if (gaps.has(lastIndexOf(piece))) {
      words.push(word);
      word = [];
    }
  }
  if (word.length > 0) words.push(word);
  return words;
}

/** 조각을 줄바꿈 단위로 묶는다: 닫는 기호(。！」)는 바로 앞 조각에 붙인다 */
function keepPunctuation(pieces: readonly Piece[], target: readonly string[]): Piece[][] {
  const groups: Piece[][] = [];
  for (const piece of pieces) {
    const closing = piece.kind === 'char' && NO_LINE_START.has(target[piece.index] ?? '');
    const last = groups[groups.length - 1];
    if (closing && last) last.push(piece);
    else groups.push([piece]);
  }
  return groups;
}

/**
 * 한자 표기 하나의 상태: 변환함 / 읽기까지 쳐서 후보를 고를 차례 / 읽기 그대로 確定해 버림 / 아직.
 * 한자를 읽기로 쳐도 되는 설정이어도 바꾸지 않은 한자에는 밑줄을 긋는다(2026-10-26 사용자 요청).
 * 다만 틀린 것이 아니므로 確定한 뒤에도 붉은 밑줄 대신 점선(후보에서 고를 수 있는 곳)으로 둔다
 */
function rubyStatus(
  converted: boolean,
  read: boolean,
  composing: boolean,
  readingOk: boolean,
): CharStatus {
  if (converted) return 'correct';
  if (!read) return 'todo';
  return composing || readingOk ? 'pending' : 'unconverted';
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
    const status = rubyStatus(
      session.converted[n] === true,
      read,
      session.composing,
      session.readingOk,
    );
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
  const pieceOf = (piece: Piece) =>
    piece.kind === 'ruby' ? (
      <ruby key={`r${piece.indexes[0]}`} className={`ch-ruby ch-${piece.status}`}>
        {piece.surface}
        <rt>{piece.indexes.map(char)}</rt>
      </ruby>
    ) : (
      char(piece.index)
    );

  const pieces: Piece[] =
    session.rubies.length > 0
      ? piecesOf(session, statuses)
      : session.target.map((_, index) => ({ kind: 'char', index }));

  // 어절 경계가 없으면 글자마다 줄이 바뀔 수 있다 (기초 줄·단어·문장). 있으면 어절을 통째로 넘긴다
  if (gapsAfter.length === 0) {
    return (
      <p className="target-text" lang="ja" aria-label={label}>
        {keepPunctuation(pieces, session.target).map((group) =>
          group.length === 1 ? (
            pieceOf(group[0] as Piece)
          ) : (
            <span key={`k${keyOf(group[0] as Piece)}`} className="ch-keep">
              {group.map(pieceOf)}
            </span>
          ),
        )}
      </p>
    );
  }
  return (
    <p className="target-text" lang="ja" aria-label={label}>
      {wordsOf(pieces, new Set(gapsAfter)).map((word) => (
        <span key={keyOf(word[0] as Piece)} className="ch-word">
          {word.map(pieceOf)}
        </span>
      ))}
    </p>
  );
}
