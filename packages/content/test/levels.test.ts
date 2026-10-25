import { describe, expect, it } from 'vitest';
import {
  KANA_KEY_ROWS,
  advanceDrill,
  createDrill,
  isKana,
  toHiragana,
  toKatakana,
  parseRuby,
  rubySurface,
  tokenizeKana,
  type LineResult,
} from '@twiper/core';
import {
  dakutenWords,
  findLevel,
  foreignWords,
  handakutenWords,
  hiraganaWords,
  kanjiWords,
  katakanaWords,
  levels,
  longVowelWords,
  nextLevel,
  nomaWords,
  punctPhrases,
  sokuonWords,
  symbolPhrases,
  vuWords,
  yoonWords,
  type ComboTopic,
  type Level,
} from '../src/index';

const BASIC_KANA = new Set(KANA_KEY_ROWS.flat().filter((char) => char !== 'ー'));
const DAKUTEN = 'がぎぐげござじずぜぞだぢづでどばびぶべぼ';
const HANDAKUTEN = 'ぱぴぷぺぽ';
const SMALL = 'ぁぃぅぇぉゃゅょっ';

/** 각 조합 레벨이 새로 쓰게 하는 글자 */
const INTRODUCES: Record<ComboTopic, string> = {
  dakuten: DAKUTEN,
  handakuten: HANDAKUTEN,
  small: SMALL,
  yoon: '',
  sokuon: '',
};

/** 외래음 레벨에서 배우는 작은 모음 */
const SMALL_VOWELS = 'ァィゥェォ';
/** 문장부호 레벨에서 배우는 かな 자판의 기호 (전각 ？！) */
const PUNCT = '、。？！「」';
/** ☆123 기호 레벨에서 배우는 기호 (〜는 U+301C) */
const SYMBOLS = '\u{301C}…・♪☆';

/**
 * 이 레벨까지 배운 글자. 가타카나 레벨은 그때까지 배운 히라가나의 가타카나를, 장음 레벨은 ー를,
 * 외래음 레벨은 작은 ァィゥェォ를, ヴ 레벨은 ヴ를, 기호 레벨은 그 기호를 더한다.
 * 한자 레벨은 새로 치는 글자가 없다. 한자는 읽기를 쳐서 변환하므로 읽기 글자만 본다 (readingOf)
 */
function allowedFor(level: Level): Set<string> {
  const allowed = new Set(BASIC_KANA);
  for (const prev of levels.slice(0, levels.indexOf(level) + 1)) {
    if (prev.topic === 'katakana') for (const char of [...allowed]) allowed.add(toKatakana(char));
    else if (prev.topic === 'longVowel') allowed.add('\u{30FC}');
    else if (prev.topic === 'foreign') for (const char of SMALL_VOWELS) allowed.add(char);
    else if (prev.topic === 'vu') allowed.add('ヴ');
    else if (prev.topic === 'punct') for (const char of PUNCT) allowed.add(char);
    else if (prev.topic === 'symbol') for (const char of SYMBOLS) allowed.add(char);
    else if (prev.topic === 'kanji' || prev.topic === 'noma') continue;
    else if (prev.topic) for (const char of INTRODUCES[prev.topic]) allowed.add(char);
  }
  return allowed;
}

/** 실제로 플릭으로 칠 글자: 한자 표기는 읽기로 펼친다 ({今日|きょう} → きょう) */
const readingOf = (text: string) => parseRuby(text).chars;

/** 외래음 레벨 전에는 쓰지 않는 글자: 작은 ァィゥェォ와 ヴ */
const FOREIGN = `${SMALL_VOWELS}ヴ`;

/** 작은 ァィゥェォ가 앞 글자에 붙은 소리 (ティ ファ ウィ) */
const hasForeignSound = (word: string) =>
  tokenizeKana(word).some((unit) => unit.length > 1 && SMALL_VOWELS.includes(unit.slice(-1)));

const perfect = (line: string): LineResult => ({
  target: line,
  units: Array.from(line).length,
  firstTryUnits: Array.from(line).length,
  missed: [],
  missedIndexes: [],
  mistakeKinds: {},
  reactionMs: 0,
  elapsedMs: 1000,
  romajiSuspected: false,
  toggleSuspected: false,
});

describe('levels', () => {
  it('L1부터 L23까지 번호와 id가 차례로 이어지고, 기초 10·조합 5·가타카나 4·기호 2·한자 2개다', () => {
    expect(levels.map((level) => level.id)).toEqual(
      Array.from({ length: 23 }, (_, i) => `L${i + 1}`),
    );
    expect(levels.map((level) => level.number)).toEqual(
      Array.from({ length: 23 }, (_, i) => i + 1),
    );
    expect(levels.filter((level) => level.stage === 'kanji').map((l) => l.topic)).toEqual([
      'kanji',
      'noma',
    ]);
    expect(levels.filter((level) => level.stage === 'katakana').map((l) => l.topic)).toEqual([
      'katakana',
      'longVowel',
      'foreign',
      'vu',
    ]);
    expect(levels.filter((level) => level.stage === 'symbol').map((l) => l.topic)).toEqual([
      'punct',
      'symbol',
    ]);
    expect(levels.filter((level) => level.stage === 'basic')).toHaveLength(10);
    expect(levels.filter((level) => level.stage === 'combo').map((l) => l.topic)).toEqual([
      'dakuten',
      'handakuten',
      'small',
      'yoon',
      'sokuon',
    ]);
  });

  it('행별 레벨은 기본 가나 46자를 한 번씩 나눠 맡는다', () => {
    const focus = levels.filter((level) => level.kind === 'row').flatMap((l) => l.drill.focus);

    expect(focus).toHaveLength(46);
    expect(new Set(focus)).toEqual(BASIC_KANA);
  });

  it('행별 레벨의 각 행은 12키의 키 하나와 같다 (L9는 ら·わ 두 키)', () => {
    for (const level of levels.filter((l) => l.kind === 'row')) {
      const rows = new Set(
        level.drill.focus.map((char) => KANA_KEY_ROWS.findIndex((row) => row.includes(char))),
      );

      expect(rows.size).toBe(level.keys.length);
    }
  });

  it('행별 레벨의 복습 문자는 이전 레벨까지의 문자 전부다', () => {
    levels
      .filter((level) => level.kind === 'row')
      .forEach((level, i, rows) => {
        expect(level.drill.review).toEqual(rows.slice(0, i).flatMap((l) => l.drill.focus));
      });
  });

  it('요음 레벨은 い단 11개 × ゃゅょ = 33개 단위다', () => {
    const yoon = findLevel('L14')?.drill.focus ?? [];

    expect(yoon).toHaveLength(33);
    expect(yoon.every((unit) => tokenizeKana(unit).length === 1)).toBe(true);
  });

  it('모든 레벨을 끝까지 풀 수 있고, 줄에는 그 레벨까지 배운 글자만 나온다', () => {
    for (const level of levels) {
      const allowed = allowedFor(level);
      let state = createDrill(level.drill, 42);
      while (!state.done) state = advanceDrill(state, perfect(state.line));
      const chars = state.results.flatMap((r) => readingOf(r.target));

      expect(state.results.length).toBe(level.drill.lineCount);
      expect(chars.filter((char) => !allowed.has(char))).toEqual([]);
    }
  });

  it('레벨의 단어는 그 레벨까지 배운 글자만 쓴다', () => {
    for (const level of levels) {
      const allowed = allowedFor(level);
      const invalid = (level.drill.words ?? []).filter((word) =>
        readingOf(word).some((char) => !allowed.has(char)),
      );

      expect({ level: level.id, invalid }).toEqual({ level: level.id, invalid: [] });
    }
  });

  it('실력 확인용(도움말 없음) 레벨은 지금은 50음 랜덤 L10뿐이다', () => {
    expect(levels.filter((level) => level.assessment).map((level) => level.id)).toEqual(['L10']);
  });

  it('findLevel·nextLevel', () => {
    expect(findLevel('L3')?.keys).toEqual(['さ']);
    expect(findLevel('L99')).toBeUndefined();
    expect(nextLevel('L9')?.id).toBe('L10');
    expect(nextLevel('L10')?.id).toBe('L11');
    expect(nextLevel('L15')?.id).toBe('L16');
    expect(nextLevel('L17')?.id).toBe('L18');
    expect(nextLevel('L18')?.id).toBe('L19');
    expect(nextLevel('L19')?.id).toBe('L20');
    expect(nextLevel('L21')?.id).toBe('L22');
    expect(nextLevel('L23')).toBeUndefined();
  });
});

describe('단어 목록', () => {
  it.each([
    ['hiraganaWords', hiraganaWords, 60],
    ['dakutenWords', dakutenWords, 30],
    ['handakutenWords', handakutenWords, 15],
    ['yoonWords', yoonWords, 30],
    ['sokuonWords', sokuonWords, 30],
    ['katakanaWords', katakanaWords, 40],
    ['longVowelWords', longVowelWords, 40],
    ['foreignWords', foreignWords, 40],
    ['vuWords', vuWords, 20],
    ['punctPhrases', punctPhrases, 30],
    ['symbolPhrases', symbolPhrases, 30],
    ['kanjiWords', kanjiWords, 40],
    ['nomaWords', nomaWords, 25],
  ] as const)('%s: 겹치는 단어가 없고 %#번째 기준 개수 이상', (_, words, min) => {
    expect(new Set(words).size).toBe(words.length);
    expect(words.length).toBeGreaterThanOrEqual(min);
  });

  it('hiraganaWords는 기본 가나만 쓴다 (탁음·작은 가나·장음 없음)', () => {
    const invalid = hiraganaWords.filter((word) =>
      Array.from(word).some((char) => !BASIC_KANA.has(char)),
    );

    expect(invalid).toEqual([]);
  });

  it('조합 단어는 모두 그 레벨의 규칙을 하나 이상 담는다', () => {
    const has = (word: string, chars: string) => Array.from(word).some((c) => chars.includes(c));

    expect(dakutenWords.filter((w) => !has(w, DAKUTEN))).toEqual([]);
    expect(handakutenWords.filter((w) => !has(w, HANDAKUTEN))).toEqual([]);
    expect(yoonWords.filter((w) => !has(w, 'ゃゅょ'))).toEqual([]);
    expect(sokuonWords.filter((w) => !has(w, 'っ'))).toEqual([]);
  });

  it('요음 단어에는 아직 배우지 않은 촉음 순서를 섞지 않는다', () => {
    expect(yoonWords.filter((w) => w.includes('っ'))).toEqual([]);
  });

  it('가타카나 단어는 가타카나와 ー로만 쓰고, 외래음(ァィゥェォ·ヴ)은 아직 쓰지 않는다', () => {
    const katakanaOnly = (word: string) =>
      Array.from(word).every((c) => isKana(c) && (c === '\u{30FC}' || toHiragana(c) !== c));

    expect([...katakanaWords, ...longVowelWords].filter((w) => !katakanaOnly(w))).toEqual([]);
    expect(
      [...katakanaWords, ...longVowelWords].filter((w) =>
        Array.from(w).some((c) => FOREIGN.includes(c)),
      ),
    ).toEqual([]);
  });

  it('가타카나 단어에는 ー가 없고, 장음 단어에는 모두 ー가 있다', () => {
    expect(katakanaWords.filter((w) => w.includes('\u{30FC}'))).toEqual([]);
    expect(longVowelWords.filter((w) => !w.includes('\u{30FC}'))).toEqual([]);
  });

  it('외래음 단어는 가타카나와 ー로만 쓰고, 모두 작은 ァィゥェォ가 붙은 소리를 담고, ヴ는 아직 쓰지 않는다', () => {
    const katakanaOnly = (word: string) =>
      Array.from(word).every((c) => isKana(c) && (c === '\u{30FC}' || toHiragana(c) !== c));

    expect(foreignWords.filter((w) => !katakanaOnly(w))).toEqual([]);
    expect(foreignWords.filter((w) => !hasForeignSound(w))).toEqual([]);
    expect(foreignWords.filter((w) => w.includes('ヴ'))).toEqual([]);
  });

  it('ヴ 단어는 가타카나와 ー로만 쓰고, 모두 ヴ를 담는다', () => {
    const katakanaOnly = (word: string) =>
      Array.from(word).every((c) => isKana(c) && (c === '\u{30FC}' || toHiragana(c) !== c));

    expect(vuWords.filter((w) => !katakanaOnly(w))).toEqual([]);
    expect(vuWords.filter((w) => !w.includes('ヴ'))).toEqual([]);
  });

  it('가타카나 레벨은 단어만 내고 確定한 결과로 채점한다', () => {
    for (const id of ['L16', 'L17', 'L18', 'L19']) {
      const drill = findLevel(id)?.drill;

      expect(drill?.judge).toBe('commit');
      expect(drill?.focus).toEqual([]);
    }
  });

  it('기호 레벨의 짧은 말은 히라가나와 그 레벨의 기호로만 쓰고, 모두 그 기호를 하나 이상 담는다', () => {
    const hiragana = (c: string) => isKana(c) && toHiragana(c) === c;
    const only = (phrase: string, symbols: string) =>
      Array.from(phrase).every((c) => hiragana(c) || symbols.includes(c));
    const has = (phrase: string, symbols: string) =>
      Array.from(phrase).some((c) => symbols.includes(c));

    // ☆123 기호의 짧은 말에는 앞에서 배운 문장부호와 ー도 쓴다
    expect(punctPhrases.filter((p) => !only(p, PUNCT) || !has(p, PUNCT))).toEqual([]);
    expect(
      symbolPhrases.filter((p) => !only(p, `${PUNCT}${SYMBOLS}\u{30FC}`) || !has(p, SYMBOLS)),
    ).toEqual([]);
  });

  it('문장부호 레벨은 조합 중에 맞으면, ☆123 기호 레벨은 確定한 결과로 채점한다', () => {
    expect(findLevel('L20')?.drill.judge).toBeUndefined();
    expect(findLevel('L21')?.drill.judge).toBe('commit');
    expect(levels.filter((level) => level.drill.judge === 'commit')).toHaveLength(7);
  });

  it('한자 단어는 모두 표기 하나에 히라가나 읽기를 붙였고, 々 단어는 모두 々를 쓴다', () => {
    const one = (word: string) => {
      const { surface, rubies, chars } = parseRuby(word);
      return (
        rubies.length === 1 &&
        rubies[0]?.surface === surface &&
        /\p{Script=Han}/u.test(surface) &&
        chars.every((c) => isKana(c) && toHiragana(c) === c)
      );
    };

    expect([...kanjiWords, ...nomaWords].filter((w) => !one(w))).toEqual([]);
    expect(kanjiWords.filter((w) => rubySurface(w).includes('々'))).toEqual([]);
    expect(nomaWords.filter((w) => !rubySurface(w).includes('々'))).toEqual([]);
  });

  it('한자 레벨은 단어만 내고 確定한 결과로 채점한다', () => {
    for (const id of ['L22', 'L23']) {
      const level = findLevel(id);

      expect(level?.stage).toBe('kanji');
      expect(level?.drill.judge).toBe('commit');
      expect(level?.drill.focus).toEqual([]);
    }
  });
});
