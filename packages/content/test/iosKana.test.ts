import { describe, expect, it } from 'vitest';
import { explainChar, findKeyStep, guideClaims } from '@twiper/core';
import { iosKana, levels } from '../src/index';
import deviceCheck from './fixtures/ios-kana-guide-check-2026-10-17.json';

const BASIC_KANA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';

describe('iosKana 가이드', () => {
  const claims = guideClaims(iosKana);

  it('주장 id가 겹치지 않는다', () => {
    const ids = claims.map((claim) => claim.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('기본 가나 46자와 장음 기호를 かな 레이어에서 입력할 수 있다', () => {
    const missing = Array.from(`${BASIC_KANA}ー`).filter(
      (kana) => findKeyStep(iosKana, kana) === null,
    );

    expect(missing).toEqual([]);
  });

  it('숫자와 영문 소문자를 각 레이어에서 입력할 수 있다', () => {
    const digits = Array.from('0123456789').filter(
      (char) => findKeyStep(iosKana, char, 'number') === null,
    );
    const letters = Array.from('abcdefghijklmnopqrstuvwxyz').filter(
      (char) => findKeyStep(iosKana, char, 'alpha') === null,
    );

    expect(digits).toEqual([]);
    expect(letters).toEqual([]);
  });

  it('키 위치가 4행 × 3열 안에 있고 레이어 안에서 겹치지 않는다', () => {
    for (const layer of Object.values(iosKana.layers)) {
      const positions = layer.keys.map((key) => `${key.row},${key.col}`);

      expect(new Set(positions).size).toBe(positions.length);
      expect(layer.keys.every((key) => key.row >= 0 && key.row < 4)).toBe(true);
      expect(layer.keys.every((key) => key.col >= 0 && key.col < 3)).toBe(true);
    }
  });

  it('출력은 모두 한 글자다', () => {
    const multi = claims.filter((claim) => Array.from(claim.expected).length !== 1);

    expect(multi.map((claim) => claim.id)).toEqual([]);
  });
});

describe('iosKana 가이드 — 2026-10-17 실기기 기록과 대조', () => {
  const byId = new Map(guideClaims(iosKana).map((claim) => [claim.id, claim]));
  const typed = deviceCheck.results.filter((result) => result.status === 'typed');

  it.each(
    typed.filter((result) => byId.has(result.id)).map((result) => [result.id, result] as const),
  )('%s — 가이드의 예상이 기기에서 나온 문자와 같다', (_id, result) => {
    expect(byId.get(result.id)?.expected).toBe(result.actual);
  });

  it('기록에는 있지만 가이드에서 뺀 항목은 변형 키 플릭뿐이다', () => {
    const removed = typed.filter((result) => !byId.has(result.id)).map((result) => result.id);

    expect(removed).toEqual([
      'modifier.direct.left',
      'modifier.direct.right',
      'modifier.direct.up',
    ]);
  });

  it('小゛゜ 키는 플릭 없이 탭할 때마다 변형을 순환한다', () => {
    expect(iosKana.modifier.direct).toEqual([]);
    expect(byId.get('modifier.cycle.つ.1')?.expected).toBe('っ');
    expect(byId.get('modifier.cycle.つ.2')?.expected).toBe('づ');
    expect(byId.get('modifier.cycle.は.2')?.expected).toBe('ぱ');
  });

  it('모든 레벨에 나오는 글자는 상황별 도움말로 치는 법을 보여 줄 수 있다', () => {
    const chars = new Set(
      levels.flatMap(({ drill }) =>
        [...drill.focus, ...drill.review, ...(drill.words ?? [])].flatMap((text) =>
          Array.from(text),
        ),
      ),
    );
    const missing = [...chars].filter((char) => explainChar(iosKana, char) === null);

    expect(missing).toEqual([]);
  });

  it('ぱ는 は를 친 뒤 小゛゜ 2번, ッ은 つ를 친 뒤 1번이다', () => {
    expect(explainChar(iosKana, 'ぱ')).toEqual([
      { kind: 'key', layer: 'kana', keyId: 'ha', label: 'は', dir: 'tap', out: 'は' },
      { kind: 'modifier', dir: 'tap', times: 2, out: 'ぱ' },
    ]);
    expect(explainChar(iosKana, 'ッ')?.map((step) => step.out)).toEqual(['つ', 'っ']);
  });
});
