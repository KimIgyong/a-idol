import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_THEME,
  THEME_NAMES,
  themes,
  type ThemeColors,
  type ThemeName,
} from './tokens';

const STORAGE_KEY = '@a-idol/theme/v1';

interface ThemeContextShape {
  /** 현재 테마 이름. */
  name: ThemeName;
  /** 현재 테마의 색상 토큰. */
  colors: ThemeColors;
  /** 테마 변경 — AsyncStorage 영속화 포함. */
  setTheme: (next: ThemeName) => void;
  /** AsyncStorage에서 선호 테마를 읽어오는 동안 true. 초기 깜빡임 방지용. */
  hydrating: boolean;
}

const fallbackContext: ThemeContextShape = {
  name: DEFAULT_THEME,
  colors: themes[DEFAULT_THEME],
  setTheme: () => undefined,
  hydrating: false,
};

const ThemeContext = createContext<ThemeContextShape>(fallbackContext);

interface ProviderProps {
  children: ReactNode;
  /**
   * AsyncStorage 부재 시 사용할 초기 테마. 테스트에서 hydration을 우회할 때
   * 유용. 기본값은 `DEFAULT_THEME` (blue + 라이트 모드).
   */
  initialTheme?: ThemeName;
  /**
   * 테스트 또는 SSR 시 storage 우회. 기본은 `AsyncStorage`.
   */
  storage?: { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> };
}

/**
 * 5 테마(blue/white/dark/pink/purple) 시스템 — RPT-260426-C P0.
 *
 * 정책:
 *  - default = `blue` (라이트 모드). 시스템 다크모드 자동 추적은 OFF —
 *    사용자가 SCR-025 설정에서 명시적으로 `dark` 선택해야 다크 적용.
 *  - 변경은 `AsyncStorage`에 즉시 영속화. 다음 앱 부팅 시 동일 테마.
 *  - 잘못 저장된 값(예: 구버전)이 있으면 default로 fallback.
 */
export function ThemeProvider({ children, initialTheme = DEFAULT_THEME, storage = AsyncStorage }: ProviderProps) {
  const [name, setName] = useState<ThemeName>(initialTheme);
  const [hydrating, setHydrating] = useState(true);

  // Boot-time hydration — 저장된 선호 테마 적용.
  useEffect(() => {
    let cancelled = false;
    storage
      .getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored && (THEME_NAMES as readonly string[]).includes(stored)) {
          setName(stored as ThemeName);
        }
      })
      .catch(() => {
        // storage 읽기 실패 시 default 유지 — 사용자가 다시 설정하면 됨.
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setName(next);
      void storage.setItem(STORAGE_KEY, next);
    },
    [storage],
  );

  const value = useMemo<ThemeContextShape>(
    () => ({
      name,
      colors: themes[name],
      setTheme,
      hydrating,
    }),
    [name, setTheme, hydrating],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 테마 토큰을 사용하는 모든 컴포넌트의 진입점. */
export function useTheme(): ThemeContextShape {
  return useContext(ThemeContext);
}
