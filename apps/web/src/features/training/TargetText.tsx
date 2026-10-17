import { charStatuses, type InputSessionState } from '@twiper/core';

interface TargetTextProps {
  session: InputSessionState;
  label?: string;
}

/** 목표 문자열. 입력한 글자는 잉크색, 오타는 붉은색, 다음에 칠 글자는 마젠타 밑줄로 보여 준다. */
export function TargetText({ session, label }: TargetTextProps) {
  const statuses = charStatuses(session);
  const next = session.value.length;
  return (
    <p className="target-text" lang="ja" aria-label={label}>
      {session.target.map((char, i) => (
        <span key={i} className={`ch-${statuses[i] ?? 'todo'}${i === next ? ' ch-next' : ''}`}>
          {char}
        </span>
      ))}
    </p>
  );
}
