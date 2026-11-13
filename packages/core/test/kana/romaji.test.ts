import { describe, expect, it } from 'vitest';
import { toRomaji, wordsPerMinute } from '../../src/index';

describe('toRomaji', () => {
  it.each([
    ['あいうえお', 'aiueo'],
    ['しちつふ', 'shichitsufu'],
    ['じぢづ', 'jijizu'],
    ['がっこう', 'gakkou'],
    ['まって', 'matte'],
    ['いっちょう', 'itchou'],
    ['きゃく', 'kyaku'],
    ['しゃしん', 'shashin'],
    ['ちょっと', 'chotto'],
    ['じゅぎょう', 'jugyou'],
    ['ぴゃく', 'pyaku'],
    ['てんいん', "ten'in"],
    ['こんや', "kon'ya"],
    ['かんじ', 'kanji'],
    ['をわ', 'owa'],
    // 가타카나는 히라가나와 같고, 장음은 -
    ['コーヒー', 'ko-hi-'],
    ['パーティー', 'pa-ti-'],
    ['ファイル', 'fairu'],
    ['ウィーク', 'wi-ku'],
    ['シェア', 'shea'],
    ['チェック', 'chekku'],
    ['ヴァイオリン', 'vaiorin'],
    ['デュエット', 'dyuetto'],
    ['ひゃく', 'hyaku'],
    ['イェス', 'yesu'],
    ['キェ', 'kye'],
    ['クァ', 'kwa'],
    ['グォ', 'gwo'],
    ['ジェット', 'jetto'],
    // 영문자·숫자·기호는 그대로
    ['OKです', 'OKdesu'],
    ['3じに', '3jini'],
    ['はい。', 'hai。'],
    // 앞 글자 없는 작은 글자, 뒤에 소리가 없는 っ
    ['ぁ', 'a'],
    ['あっ', 'atsu'],
  ] as const)('%s → %s', (kana, romaji) => {
    expect(toRomaji(kana)).toBe(romaji);
  });
});

describe('wordsPerMinute', () => {
  it('로마자 5글자를 한 단어로 센다', () => {
    // こんにちは = konnichiha 10글자 = 2단어, 30초 → 4 WPM
    expect(wordsPerMinute(['こんにちは'], 30_000)).toBe(4);
    expect(wordsPerMinute(['こんにちは'], 0)).toBeNull();
  });

  it("줄은 따로 바꿔 센다 (줄 끝 ん과 다음 줄 첫 모음을 n'로 잇지 않는다)", () => {
    // n + a = 2글자, 1분 → 0.4 WPM
    expect(wordsPerMinute(['ん', 'あ'], 60_000)).toBeCloseTo(0.4);
  });
});
