import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UpdateUserMeDto, UserDto } from '@a-idol/shared';
import { api } from '../api/client';

const AT_KEY = 'a-idol.at';
const RT_KEY = 'a-idol.rt';

type AuthState = {
  ready: boolean;
  user: UserDto | null;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: {
    email: string;
    password: string;
    nickname: string;
    birthdate: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** PATCH /me — avatar / 마케팅 동의 / 푸시 동의. SCR-004 + 설정 화면. */
  updateMe: (patch: UpdateUserMeDto) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserDto | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const persistTokens = useCallback(async (at: string | null, rt: string | null) => {
    setAccessToken(at);
    await Promise.all([
      at ? AsyncStorage.setItem(AT_KEY, at) : AsyncStorage.removeItem(AT_KEY),
      rt ? AsyncStorage.setItem(RT_KEY, rt) : AsyncStorage.removeItem(RT_KEY),
    ]);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.login({ email, password, device_id: 'expo-app' });
    await persistTokens(r.accessToken, r.refreshToken);
    setUser(r.user);
  }, [persistTokens]);

  const signUp = useCallback(async (payload: {
    email: string;
    password: string;
    nickname: string;
    birthdate: string;
  }) => {
    const r = await api.signup({ ...payload, device_id: 'expo-app' });
    await persistTokens(r.accessToken, r.refreshToken);
    setUser(r.user);
  }, [persistTokens]);

  const signOut = useCallback(async () => {
    // RPT-260426-D Phase D — server-side session revoke 시도. 네트워크 실패해도
    // 로컬 token은 무조건 비워 사용자 측에서 logged out 상태가 되도록.
    try {
      const rt = await AsyncStorage.getItem(RT_KEY);
      if (rt) await api.logout({ refresh_token: rt });
    } catch {
      // 무시 — server-side revoke 실패해도 token expiry로 자연 만료.
    }
    await persistTokens(null, null);
    setUser(null);
  }, [persistTokens]);

  const refreshMe = useCallback(async () => {
    if (!accessToken) return;
    try {
      const me = await api.me(accessToken);
      setUser(me);
    } catch {
      await signOut();
    }
  }, [accessToken, signOut]);

  const updateMe = useCallback(
    async (patch: UpdateUserMeDto) => {
      if (!accessToken) throw new Error('not authenticated');
      const me = await api.patchMe(patch, accessToken);
      setUser(me);
    },
    [accessToken],
  );

  useEffect(() => {
    (async () => {
      try {
        const at = await AsyncStorage.getItem(AT_KEY);
        if (at) {
          setAccessToken(at);
          try {
            const me = await api.me(at);
            setUser(me);
          } catch {
            await persistTokens(null, null);
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, [persistTokens]);

  const value = useMemo<AuthState>(
    () => ({ ready, user, accessToken, signIn, signUp, signOut, refreshMe, updateMe }),
    [ready, user, accessToken, signIn, signUp, signOut, refreshMe, updateMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
