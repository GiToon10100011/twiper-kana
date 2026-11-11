import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { loadSettings } from '../lib/settings';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { resolveLocale, type LanguageChoice } from './locale';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ko };
  }
}

const languages = typeof navigator === 'undefined' ? [] : navigator.languages;

void i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, ja: { translation: ja }, en: { translation: en } },
  lng: resolveLocale(loadSettings().language, languages),
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

const markDocument = () => {
  if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;
};
markDocument();

/** 설정에서 고른 화면 언어로 바로 바꾼다 (다시 열 때는 init이 설정을 읽는다) */
export function applyLanguage(choice: LanguageChoice): void {
  void i18n.changeLanguage(resolveLocale(choice, languages)).then(markDocument);
}

export default i18n;
