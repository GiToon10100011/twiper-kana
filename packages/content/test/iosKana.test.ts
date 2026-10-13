import { describe, expect, it } from 'vitest';
import { findKeyStep, guideClaims } from '@twiper/core';
import { iosKana } from '../src/index';

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

  it('실기 확인이 필요한 항목이 표시돼 있다', () => {
    const unverified = claims.filter((claim) => claim.unverified).map((claim) => claim.id);

    expect(unverified).toContain('kana.ya.left');
    expect(unverified).toContain('kana.wa.right');
    expect(unverified).toContain('number.8.up');
    expect(unverified).toContain('modifier.direct.left');
    expect(unverified).not.toContain('kana.a.left');
  });
});
