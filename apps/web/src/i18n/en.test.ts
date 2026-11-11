import { afterEach, describe, expect, it } from 'vitest';
import i18n from './index';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('영어 화면 문구', () => {
  it('숫자가 1이면 단수 꼴을 쓴다', async () => {
    await i18n.changeLanguage('en');

    expect(i18n.t('stats.trend.lines', { count: 1 })).toBe('1 line');
    expect(i18n.t('stats.trend.lines', { count: 3 })).toBe('3 lines');
    expect(i18n.t('stats.times', { count: 1 })).toBe('once');
    expect(i18n.t('calendar.days', { count: 2 })).toBe('2 days');
    expect(i18n.t('stats.trend.readout', { date: '11/9', value: '97%', count: 1 })).toBe(
      '11/9 · 97% · 1 line',
    );
  });

  it('한국어·일본어는 단수 꼴 없이 그대로 쓴다', async () => {
    await i18n.changeLanguage('ja');
    expect(i18n.t('stats.trend.lines', { count: 1 })).toBe('1行');
    await i18n.changeLanguage('ko');
    expect(i18n.t('stats.trend.lines', { count: 1 })).toBe('1줄');
  });
});
