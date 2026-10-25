import { describe, expect, it } from 'vitest';
import { parseRuby, rubyReading, rubySurface } from '../../src/index';

describe('parseRuby', () => {
  it('한자 표기를 읽기 글자로 펼치고, 그 자리와 표기를 남긴다', () => {
    expect(parseRuby('{時々|ときどき}は')).toEqual({
      chars: ['と', 'き', 'ど', 'き', 'は'],
      surface: '時々は',
      rubies: [{ start: 0, end: 4, surface: '時々' }],
    });
  });

  it('표기가 여럿이면 각각의 읽기 위치를 차례로 잡는다', () => {
    const { chars, surface, rubies } = parseRuby('{今日|きょう}は{雨|あめ}');

    expect(chars.join('')).toBe('きょうはあめ');
    expect(surface).toBe('今日は雨');
    expect(rubies).toEqual([
      { start: 0, end: 3, surface: '今日' },
      { start: 4, end: 6, surface: '雨' },
    ]);
  });

  it('표기가 없으면 글자를 그대로 둔다 (가타카나도 그대로)', () => {
    expect(parseRuby('コーヒー')).toEqual({
      chars: ['コ', 'ー', 'ヒ', 'ー'],
      surface: 'コーヒー',
      rubies: [],
    });
  });
});

describe('rubySurface·rubyReading', () => {
  it('화면에 보일 표기와 칠 읽기를 꺼낸다', () => {
    expect(rubySurface('{人々|ひとびと}と{話|はな}す')).toBe('人々と話す');
    expect(rubyReading('{人々|ひとびと}と{話|はな}す')).toBe('ひとびととはなす');
  });
});
