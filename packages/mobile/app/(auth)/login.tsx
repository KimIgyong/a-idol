import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontSize, radius, spacing } from '../../src/theme/tokens';

/**
 * SCR-002 Login — 와이어프레임 v2.
 *
 * 디자인 토큰 기반 + Email/Google/Apple/Facebook 4 entry. OAuth 3개는
 * placeholder (RPT-260426-C 결정 #2: 이번 phase 백엔드 미구현, 버튼만 노출).
 */
type OAuthProvider = 'google' | 'apple' | 'facebook';

const OAUTH_LABEL: Record<OAuthProvider, string> = {
  google: 'Google로 계속',
  apple: 'Apple로 계속',
  facebook: 'Facebook으로 계속',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('demo@a-idol.dev');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      // T-082 ACCOUNT_LOCKED — friendly anti-credential-stuffing 안내
      if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') {
        const retryAfterSec =
          (e.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
        const minutes = retryAfterSec ? Math.ceil(retryAfterSec / 60) : null;
        setErr(
          minutes
            ? `너무 많은 로그인 실패로 계정이 일시 잠겼습니다. 약 ${minutes}분 후 다시 시도해 주세요.`
            : `너무 많은 로그인 실패로 계정이 일시 잠겼습니다. 잠시 후 다시 시도해 주세요.`,
        );
      } else {
        setErr((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }

  function onOAuth(provider: OAuthProvider) {
    Alert.alert(
      `${OAUTH_LABEL[provider]} 준비 중`,
      'Phase 2에서 도입 예정입니다. 지금은 이메일 로그인을 사용해 주세요.',
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}>
          <Text style={[styles.title, { color: colors.accent }]}>A-idol</Text>
          <Text style={[styles.subtitle, { color: colors.text2 }]}>AI 아이돌 팬덤 플랫폼</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Field label="이메일" color={colors.text2}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
              placeholderTextColor={colors.text3}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.borderMd, color: colors.text1 },
              ]}
            />
          </Field>

          <Field label="비밀번호" color={colors.text2}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.text3}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.borderMd, color: colors.text1 },
              ]}
            />
          </Field>

          {err ? <Text style={[styles.error, { color: colors.danger }]}>⚠ {err}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="로그인"
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: colors.accent, opacity: pressed || loading ? 0.85 : 1 },
            ]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>로그인</Text>}
          </Pressable>

          <Divider color={colors.border} text="또는" textColor={colors.text3} />

          {/* OAuth placeholder — RPT-260426-C 결정 #2 */}
          <View style={{ gap: spacing.sm }}>
            <OAuthButton provider="google" onPress={() => onOAuth('google')} />
            <OAuthButton provider="apple" onPress={() => onOAuth('apple')} />
            <OAuthButton provider="facebook" onPress={() => onOAuth('facebook')} />
          </View>
        </View>

        <Link href="/(auth)/signup" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={[styles.linkText, { color: colors.text2 }]}>
              계정이 없으신가요?{' '}
              <Text style={{ color: colors.accent, fontWeight: '700' }}>회원가입</Text>
            </Text>
          </Pressable>
        </Link>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      {children}
    </View>
  );
}

function Divider({ color, text, textColor }: { color: string; text: string; textColor: string }) {
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
      <Text style={[styles.dividerText, { color: textColor }]}>{text}</Text>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
    </View>
  );
}

function OAuthButton({ provider, onPress }: { provider: OAuthProvider; onPress: () => void }) {
  const { colors } = useTheme();
  // 와이어프레임은 각 provider 브랜드 컬러를 살짝 노출. 우리는 ghost
  // 버튼으로 통일 + provider 마크 텍스트로 구분 (Phase 2에서 SVG icon 교체).
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={OAUTH_LABEL[provider]}
      accessibilityHint="아직 준비 중입니다. 안내 메시지가 표시됩니다."
      style={({ pressed }) => [
        styles.oauth,
        {
          backgroundColor: colors.bg,
          borderColor: colors.borderMd,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.oauthIcon, { backgroundColor: BRAND_COLOR[provider] }]}>
        <Text style={styles.oauthIconText}>{BRAND_LETTER[provider]}</Text>
      </View>
      <Text style={[styles.oauthText, { color: colors.text1 }]}>{OAUTH_LABEL[provider]}</Text>
    </Pressable>
  );
}

const BRAND_COLOR: Record<OAuthProvider, string> = {
  google: '#4285F4',
  apple: '#000000',
  facebook: '#1877F2',
};

const BRAND_LETTER: Record<OAuthProvider, string> = {
  google: 'G',
  apple: '',
  facebook: 'f',
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  hero: { alignItems: 'center', paddingTop: spacing.xxl, gap: 4 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  subtitle: { fontSize: fontSize.body },

  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },

  label: {
    fontSize: fontSize.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontSize: 14,
  },
  error: { fontSize: 12 },

  primary: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: fontSize.caption },

  oauth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  oauthIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthIconText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  oauthText: { fontSize: fontSize.body, fontWeight: '600' },

  linkWrap: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  linkText: { fontSize: fontSize.body },
});
