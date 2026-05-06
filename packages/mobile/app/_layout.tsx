import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { fontSize, spacing } from '../src/theme/tokens';
import { initI18n } from '../src/i18n/i18n';

/**
 * SCR-001 Splash + 인증 분기 게이트 — 와이어프레임 v2.
 *
 * 별도 라우트 대신 root `Gate`가 splash 역할 — `auth.ready`와 최소 노출
 * 시간(`minSplashElapsed`) 둘 다 만족할 때까지 splash 유지.
 *
 * 정책:
 *  - 최소 1초는 노출 — 토큰 restore가 빠르게 끝나도 UX consistency 유지.
 *  - 1초 후 ready면 destination으로 즉시 이동.
 *  - 디자인 자산 합류 시 `react-native-linear-gradient`로 gradient 배경.
 */
function Gate() {
  const { ready, user } = useAuth();
  const { colors, name: themeName } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    void initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !minSplashElapsed || !i18nReady) return;
    const inAuth = segments[0] === '(auth)';
    const onExtra = segments[1] === 'extra';
    if (!user && !inAuth) router.replace('/(auth)/login');
    // SCR-004 추가 정보(/auth/extra)는 가입 직후 signed-in 상태에서 노출되는
    // 1회성 화면 — auth group에 있어도 redirect 안 함.
    if (user && inAuth && !onExtra) router.replace('/(app)');
  }, [ready, minSplashElapsed, i18nReady, user, segments, router]);

  if (!ready || !minSplashElapsed || !i18nReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.accentDk,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: fontSize.display, fontWeight: '800', letterSpacing: -0.5 }}>
          {i18nReady ? t('app.title') : 'A-idol'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: fontSize.body }}>
          {i18nReady ? t('app.tagline') : 'AI 아이돌 팬덤 플랫폼'}
        </Text>
      </View>
    );
  }
  return (
    <>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
