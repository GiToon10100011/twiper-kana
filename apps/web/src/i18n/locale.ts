export const LOCALES = ['ko', 'ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** 설정에서 고르는 화면 언어. auto는 기기 언어를 따른다 */
export type LanguageChoice = 'auto' | Locale;

/**
 * 기기 언어 목록에서 처음 나오는 한국어·일본어·영어를 고른다.
 * 셋 다 없으면 영어 (한국어·일본어를 쓰지 않는 사람에게는 영어가 가장 읽기 쉽다)
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'ko' || base === 'ja' || base === 'en') return base;
  }
  return 'en';
}

/** 설정에서 고른 언어. 기기 언어를 따르면 기기 언어 목록에서 고른다 */
export const resolveLocale = (choice: LanguageChoice, languages: readonly string[]): Locale =>
  choice === 'auto' ? detectLocale(languages) : choice;
