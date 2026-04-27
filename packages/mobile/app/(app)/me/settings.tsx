import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { THEME_LABEL, THEME_NAMES, fontSize, radius, spacing, type ThemeName } from '../../../src/theme/tokens';

/**
 * SCR-025 — 설정 (5 테마 전환).
 *
 * 와이어프레임 v2의 5 테마 시스템을 즉시 전환할 수 있는 화면. 선택은
 * AsyncStorage에 영속화되어 다음 부팅 시에도 유지(ThemeProvider 책임).
 *
 * Phase 0 이후 알림 설정, 푸시 토큰 관리, 데이터 거주(PDPA/PIPA) 동의
 * history 등이 같은 화면 또는 sub-routes로 추가됨 (RPT-260426-C P4).
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { colors, name, setTheme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
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
        <Text style={[styles.title, { color: colors.text1 }]}>설정</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={[styles.section, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.text2 }]}>테마</Text>
        <Text style={[styles.sectionHint, { color: colors.text3 }]}>
          앱 전체에 즉시 반영되며 다음 실행에도 유지됩니다.
        </Text>
        <View style={styles.themeGrid}>
          {THEME_NAMES.map((theme) => (
            <ThemeChip
              key={theme}
              theme={theme}
              active={name === theme}
              onPress={() => setTheme(theme)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.metaCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Row label="현재 테마" value={THEME_LABEL[name]} />
        <Row label="기본값" value={`${THEME_LABEL.blue} (라이트)`} />
      </View>
    </SafeAreaView>
  );
}

interface ChipProps {
  theme: ThemeName;
  active: boolean;
  onPress: () => void;
}

function ThemeChip({ theme, active, onPress }: ChipProps) {
  // Chip 자체의 색은 활성 테마가 아니라 chip이 가리키는 테마의 accent로
  // 미리보기를 줘야 admin이 "이거 누르면 어떤 색?"을 즉시 알 수 있음.
  const { colors: activeColors } = useTheme();
  // import 순환 피하려고 themes 직접 접근 대신 이름→hex 인라인 매핑.
  const swatch = SWATCH[theme];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${THEME_LABEL[theme]} 테마`}
      accessibilityState={{ selected: active }}
      accessibilityHint={active ? undefined : '탭하면 테마가 즉시 변경됩니다.'}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? activeColors.accentLt : activeColors.bg,
          borderColor: active ? activeColors.accent : activeColors.borderMd,
          borderWidth: active ? 2 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: swatch }]} />
      <Text
        style={[
          styles.chipLabel,
          { color: active ? activeColors.accent : activeColors.text2, fontWeight: active ? '700' : '600' },
        ]}
      >
        {THEME_LABEL[theme]}
      </Text>
    </Pressable>
  );
}

// 각 테마의 대표 색(swatch). tokens.ts와 동기화 — 변경 시 둘 다 업데이트.
const SWATCH: Record<ThemeName, string> = {
  blue: '#2563EB',
  white: '#111111',
  dark: '#60A5FA',
  pink: '#EC4899',
  purple: '#8B5CF6',
};

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowKey, { color: colors.text2 }]}>{label}</Text>
      <Text style={[styles.rowVal, { color: colors.text1 }]}>{value}</Text>
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

  section: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: fontSize.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sectionHint: { fontSize: fontSize.caption, marginBottom: spacing.md },

  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chipLabel: { fontSize: fontSize.label },

  metaCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowKey: { fontSize: fontSize.body },
  rowVal: { fontSize: fontSize.body, fontWeight: '600' },
});
