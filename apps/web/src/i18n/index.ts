import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ja } from './ja';
import { ko } from './ko';
import { detectLocale } from './locale';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ko };
  }
}

const languages = typeof navigator === 'undefined' ? [] : navigator.languages;

void i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, ja: { translation: ja } },
  lng: detectLocale(languages),
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;

export default i18n;
