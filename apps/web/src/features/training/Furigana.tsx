import type { ReactNode } from 'react';
import { parseRuby } from '@twiper/core';

/** 읽기만 보여 주는 한자 표기 (채팅의 상대 말). 진행 색 없이 한자 위에 읽기를 작게 붙인다 */
export function Furigana({ text }: { text: string }) {
  const { chars, rubies } = parseRuby(text);
  const parts: ReactNode[] = [];
  let i = 0;
  for (const ruby of rubies) {
    parts.push(chars.slice(i, ruby.start).join(''));
    parts.push(
      <ruby key={ruby.start}>
        {ruby.surface}
        <rt>{chars.slice(ruby.start, ruby.end).join('')}</rt>
      </ruby>,
    );
    i = ruby.end;
  }
  parts.push(chars.slice(i).join(''));
  return <>{parts}</>;
}
