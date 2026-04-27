import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontSize, radius, spacing } from '../../src/theme/tokens';

/**
 * SCR-003 Signup — 와이어프레임 v2.
 *
 * 가입 직후 SCR-004 추가 정보 화면으로 redirect (RPT-260426-C 결정 #3).
 * 닉네임/생년월일은 이 화면에서 받고, 마케팅 동의 + 프로필 사진은
 * SCR-004에서 별도 수집.
 */
export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const r = Math.floor(Math.random() * 10_000);
  const [form, setForm] = useState({
    email: `demo${r}@a-idol.dev`,
    password: 'password123',
    nickname: `fan${r}`,
    birthdate: '2000-01-01',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K) {
    return (v: string) => setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      await signUp(form);
      // SCR-004로 redirect — 가입 직후 1회성 추가 정보 수집.
      router.replace('/(auth)/extra');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.backBtn, { backgroundColor: colors.bg, borderColor: colors.borderMd }]}
        >
          <Text style={[styles.backText, { color: colors.text1 }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text1 }]}>회원가입</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.formCard,
          { backgroundColor: colors.bg, borderColor: colors.border },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="이메일" color={colors.text2}>
          <TextInput
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.borderMd, color: colors.text1 },
            ]}
            placeholderTextColor={colors.text3}
          />
        </Field>
        <Field label="비밀번호" color={colors.text2}>
          <TextInput
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.borderMd, color: colors.text1 },
            ]}
          />
        </Field>
        <Field label="닉네임" color={colors.text2}>
          <TextInput
            value={form.nickname}
            onChangeText={set('nickname')}
            autoCapitalize="none"
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.borderMd, color: colors.text1 },
            ]}
          />
        </Field>
        <Field label="생년월일 (YYYY-MM-DD)" color={colors.text2}>
          <TextInput
            value={form.birthdate}
            onChangeText={set('birthdate')}
            placeholder="2000-01-01"
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
          accessibilityLabel="가입하고 계속"
          accessibilityState={{ disabled: loading, busy: loading }}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: colors.accent, opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>가입하고 계속</Text>}
        </Pressable>

        <Text style={[styles.fineprint, { color: colors.text3 }]}>
          만 14세 이상만 가입 가능합니다.
        </Text>
      </ScrollView>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 20, lineHeight: 22, marginTop: -2 },
  title: { fontSize: fontSize.heading, fontWeight: '800', letterSpacing: -0.5 },

  formCard: {
    margin: spacing.lg,
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

  fineprint: { fontSize: fontSize.caption, textAlign: 'center', marginTop: spacing.xs },
});
