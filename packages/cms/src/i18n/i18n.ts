import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import koCommon from './ko/common.json';
import koNav from './ko/nav.json';
import koIssue from './ko/issue.json';
import enCommon from './en/common.json';
import enNav from './en/nav.json';
import enIssue from './en/issue.json';
import viCommon from './vi/common.json';
import viNav from './vi/nav.json';
import viIssue from './vi/issue.json';
import zhCNCommon from './zh-CN/common.json';
import zhCNNav from './zh-CN/nav.json';
import zhCNIssue from './zh-CN/issue.json';

// 코드 컨벤션 §14 — 4 locale × namespace 구조.
// 신규 namespace 추가 시: 각 locale 폴더에 JSON 추가 + 아래 resources 등록.
export const SUPPORTED_LOCALES = ['ko', 'en', 'vi', 'zh-CN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABEL: Record<SupportedLocale, string> = {
  ko: '한국어',
  en: 'English',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
};

const STORAGE_KEY = 'a-idol.cms.lang';

export const resources = {
  ko: { common: koCommon, nav: koNav, issue: koIssue },
  en: { common: enCommon, nav: enNav, issue: enIssue },
  vi: { common: viCommon, nav: viNav, issue: viIssue },
  'zh-CN': { common: zhCNCommon, nav: zhCNNav, issue: zhCNIssue },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ko',
    supportedLngs: [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true, // `zh` → `zh-CN` 매핑
    ns: ['common', 'nav', 'issue'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: { useSuspense: false },
  });

export default i18n;
