import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontSize, radius, spacing } from '../../src/theme/tokens';

/**
 * SCR-004 추가 정보 — 가입 직후 1회성 수집 (RPT-260426-C 결정 #3).
 *
 * 닉네임/생년월일/이메일은 회원가입에서 이미 받음. 이 화면은 옵션 항목만:
 *  - 프로필 사진 URL (선택)
 *  - 마케팅 수신 동의 (PIPA/PDPA — 기본 OFF)
 *  - 푸시 알림 동의 (기본 ON)
 *
 * "건너뛰기" 가능. 모두 선택사항이라 회원가입 자체는 이미 완료된 상태.
 * `updateMe` PATCH /me로 한 번에 업데이트.
 */
export default function ExtraInfoScreen() {
  const router = useRouter();
  const { user, updateMe } = useAuth();
  const { colors } = useTheme();

  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [marketingOptIn, setMarketingOptIn] = useState(user?.marketingOptIn ?? false);
  const [pushOptIn, setPushOptIn] = useState(user?.pushOptIn ?? true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setLoading(true);
    try {
      await updateMe({
        avatar_url: avatarUrl.trim() || null,
        marketing_opt_in: marketingOptIn,
        push_opt_in: pushOptIn,
      });
      router.replace('/(app)');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function skip() {
    router.replace('/(app)');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text1 }]}>거의 다 됐어요!</Text>
        <Pressable
          onPress={skip}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="건너뛰기"
          accessibilityHint="설정 없이 바로 홈으로 이동합니다."
        >
          <Text style={[styles.skip, { color: colors.text2 }]}>건너뛰기</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.card,
          { backgroundColor: colors.bg, borderColor: colors.border },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.lead, { color: colors.text2 }]}>
          {user?.nickname ?? '환영합니다'}님, 몇 가지 옵션을 설정하면 더 즐거운
          경험이 됩니다. 모두 선택사항이며 나중에 설정에서 변경할 수 있어요.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text2 }]}>프로필 사진 URL</Text>
          <TextInput
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://..."
            placeholderTextColor={colors.text3}
            keyboardType="url"
            autoCapitalize="none"
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.borderMd, color: colors.text1 },
            ]}
          />
          <Text style={[styles.hint, { color: colors.text3 }]}>
            이미지 업로드는 다음 업데이트에서 지원될 예정입니다.
          </Text>
        </View>

        <Toggle
          label="마케팅 정보 수신"
          hint="이벤트 소식, 신규 아이돌 알림. 언제든 끌 수 있습니다."
          value={marketingOptIn}
          onChange={setMarketingOptIn}
        />

        <Toggle
          label="푸시 알림"
          hint="채팅 메시지, 라운드 종료 알림 등."
          value={pushOptIn}
          onChange={setPushOptIn}
        />

        {err ? <Text style={[styles.error, { color: colors.danger }]}>⚠ {err}</Text> : null}

        <Pressable
          onPress={save}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="완료"
          accessibilityState={{ disabled: loading, busy: loading }}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: colors.accent, opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>완료</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, styles.toggleRow]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: colors.text1 }]}>{label}</Text>
        <Text style={[styles.hint, { color: colors.text3 }]}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderMd, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: fontSize.heading, fontWeight: '800', letterSpacing: -0.5 },
  skip: { fontSize: fontSize.body, fontWeight: '600' },

  card: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
  },

  lead: { fontSize: fontSize.body, lineHeight: 19 },

  section: { gap: 6 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  label: {
    fontSize: fontSize.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleLabel: { fontSize: fontSize.body, fontWeight: '600' },
  hint: { fontSize: fontSize.caption, marginTop: 2 },

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
    marginTop: spacing.sm,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
