import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import koCommon from './ko/common.json';
import koNav from './ko/nav.json';
import enCommon from './en/common.json';
import enNav from './en/nav.json';
import viCommon from './vi/common.json';
import viNav from './vi/nav.json';
import zhCNCommon from './zh-CN/common.json';
import zhCNNav from './zh-CN/nav.json';

// 코드 컨벤션 §14 — Mobile i18n. 4 locale × namespace 구조.
// 신규 namespace 추가 시: 각 locale 폴더에 JSON 추가 + 아래 resources 등록.
export const SUPPORTED_LOCALES = ['ko', 'en', 'vi', 'zh-CN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABEL: Record<SupportedLocale, string> = {
  ko: '한국어',
  en: 'English',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
};

const STORAGE_KEY = 'a-idol.mobile.lang';
const FALLBACK: SupportedLocale = 'ko';

const resources = {
  ko: { common: koCommon, nav: koNav },
  en: { common: enCommon, nav: enNav },
  vi: { common: viCommon, nav: viNav },
  'zh-CN': { common: zhCNCommon, nav: zhCNNav },
} as const;

/**
 * BCP-47 tag → 지원 locale 정규화.
 * 예: `ko-KR` → `ko`, `zh-Hans-CN` → `zh-CN`, `zh-TW` → `ko`(fallback) (별도 ADR 전까지).
 */
function normalize(tag: string | null | undefined): SupportedLocale {
  if (!tag) return FALLBACK;
  const lower = tag.toLowerCase();
  if (lower.startsWith('ko')) return 'ko';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('vi')) return 'vi';
  // 중국어: Hans / CN 만 지원. Hant / TW / HK 는 fallback.
  if (lower.includes('hans') || lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh_cn')) {
    return 'zh-CN';
  }
  return FALLBACK;
}

async function detectInitialLanguage(): Promise<SupportedLocale> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as SupportedLocale;
    }
  } catch {
    // AsyncStorage 미가용 (web SSR 등) — Localization 으로 진행
  }
  const device = Localization.getLocales()[0]?.languageTag;
  return normalize(device);
}

// react-i18next 의 useTranslation 은 hook 호출 시점에 i18n 인스턴스가
// `initReactI18next` 를 거쳐야만 동작한다. initI18n() 은 async (AsyncStorage
// 접근) 이라 첫 렌더보다 늦게 끝나, splash 가 useTranslation 을 호출하는 순간
// "You will need to pass in an i18next instance by using initReactI18next"
// 경고 + undefined.length 크래시가 발생.
// → 모듈 로드 시점에 동기 init 으로 fallback locale 을 먼저 활성화하고,
//   initI18n() 은 stored/device locale 로 비동기 업데이트만 담당.
if (!i18n.isInitialized) {
  // eslint-disable-next-line no-void
  void i18n.use(initReactI18next).init({
    resources,
    lng: FALLBACK,
    fallbackLng: FALLBACK,
    supportedLngs: [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true,
    ns: ['common', 'nav'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initImmediate: false, // 동기 init — useTranslation 첫 호출 시점에 ready
  });
}

let initPromise: Promise<typeof i18n> | null = null;

export function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const lng = await detectInitialLanguage();
    if (lng !== i18n.language) {
      await i18n.changeLanguage(lng);
    }
    return i18n;
  })();
  return initPromise;
}

export async function changeLanguage(code: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export default i18n;
