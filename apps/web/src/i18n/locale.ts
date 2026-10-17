export const LOCALES = ['ko', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

/** 기기 언어 목록에서 처음 나오는 한국어·일본어를 고른다. 둘 다 없으면 한국어 (영어는 M4) */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'ko' || base === 'ja') return base;
  }
  return 'ko';
}
