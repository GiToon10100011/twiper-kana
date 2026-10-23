import { describe, expect, it } from 'vitest';
import { lookupChar } from '@twiper/core';
import { charTables, iosKana } from '../src/index';

const cells = charTables.flatMap((table) => table.rows.flat());

describe('charTables (글자 찾기 표)', () => {
  it('표의 모든 글자는 iPhone かな 키보드로 치는 법을 보여 줄 수 있다', () => {
    const missing = cells.filter((cell) =>
      Array.from(cell).some((char) => lookupChar(iosKana, char) === null),
    );
    expect(missing).toEqual([]);
  });

  it('같은 글자가 두 번 나오지 않는다', () => {
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('한 줄은 5칸을 넘지 않는다 (5열 표)', () => {
    const wide = charTables.flatMap((table) => table.rows.filter((row) => row.length > 5));
    expect(wide).toEqual([]);
  });

  it('기호 표의 〜·…·々는 ☆123 자판에서 친다', () => {
    for (const char of ['\u{301C}', '…', '々']) {
      expect(lookupChar(iosKana, char)?.[0]).toMatchObject({ kind: 'key', layer: 'number' });
    }
  });
});
