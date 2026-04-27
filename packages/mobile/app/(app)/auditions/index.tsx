import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuditionListItemDto } from '@a-idol/shared';
import { useAuditionsList } from '../../../src/hooks/useAuditions';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-010 오디션 대시보드 — RPT-260426-C P3.
 *
 * Public ACTIVE 오디션을 시작 시각 기준으로 분리:
 *  - 진행중 (now ∈ [startAt, endAt])
 *  - 곧 시작 (startAt > now)
 *  - 지난 오디션 → `/auditions/past` 진입.
 */
export default function AuditionsDashboard() {
  const router = useRouter();
  const { items, loading, error, refresh } = useAuditionsList('ACTIVE');
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { running, upcoming } = useMemo(() => {
    const now = Date.now();
    const r: AuditionListItemDto[] = [];
    const u: AuditionListItemDto[] = [];
    for (const a of items) {
      const start = new Date(a.startAt).getTime();
      const end = new Date(a.endAt).getTime();
      if (start <= now && now <= end) r.push(a);
      else if (start > now) u.push(a);
      else r.push(a); // ACTIVE인데 endAt이 지났으면 (status flip 지연) 진행중으로 노출
    }
    return { running: r, upcoming: u };
  }, [items]);

  const goDetail = (id: string) =>
    router.push({ pathname: '/(app)/auditions/[id]', params: { id } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>오디션</Text>
          <Text style={styles.sub}>{items.length}개의 오디션이 공개 중</Text>
        </View>
        <Pressable
          onPress={refresh}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="오디션 목록 새로 고침"
        >
          <Text style={styles.refresh}>↻</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        {error ? <Text style={styles.error}>⚠ {error}</Text> : null}

        {/* 지난 오디션 entry */}
        <Pressable
          onPress={() => router.push('/(app)/auditions/past')}
          accessibilityRole="link"
          accessibilityLabel="지난 오디션 보기"
          accessibilityHint="완료된 오디션 결과와 회차별 leaderboard로 이동합니다."
          style={({ pressed }) => [styles.pastEntry, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.pastEntryTitle}>지난 오디션 보기</Text>
            <Text style={styles.pastEntrySub}>완료된 오디션 결과 + 회차별 leaderboard</Text>
          </View>
          <Text style={styles.pastEntryChev}>›</Text>
        </Pressable>

        <Section title="진행중" colors={colors}>
          {loading && items.length === 0 ? (
            <ActivityIndicator color={colors.accent} />
          ) : running.length === 0 ? (
            <Text style={styles.emptyText}>진행 중인 오디션이 없습니다.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {running.map((a) => (
                <AuditionCard key={a.id} item={a} variant="running" colors={colors} onPress={() => goDetail(a.id)} />
              ))}
            </View>
          )}
        </Section>

        <Section title="곧 시작" colors={colors}>
          {upcoming.length === 0 ? (
            <Text style={styles.emptyText}>예정된 오디션이 없습니다.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {upcoming.map((a) => (
                <AuditionCard key={a.id} item={a} variant="upcoming" colors={colors} onPress={() => goDetail(a.id)} />
              ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
      <Text
        style={{
          color: colors.text2,
          fontSize: fontSize.label,
          fontWeight: '700',
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function AuditionCard({
  item,
  variant,
  colors,
  onPress,
}: {
  item: AuditionListItemDto;
  variant: 'running' | 'upcoming';
  colors: ThemeColors;
  onPress: () => void;
}) {
  const accent = variant === 'running' ? colors.success : colors.accent;
  const badge = variant === 'running' ? 'LIVE' : '예정';
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${badge} ${item.name}, 참가 ${item.entries}명, 라운드 ${item.rounds}개`}
      accessibilityHint="오디션 상세로 이동합니다."
      style={({ pressed }) => [
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: 6,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            backgroundColor: accent,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ color: '#fff', fontSize: fontSize.caption, fontWeight: '800' }}>
            {badge}
          </Text>
        </View>
        <Text style={{ color: colors.text1, fontSize: fontSize.heading, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
        {start.toLocaleDateString()} → {end.toLocaleDateString()}
      </Text>
      <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
        🎤 참가 {item.entries} · 🏁 라운드 {item.rounds}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.pageBg },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    title: { color: colors.text1, fontSize: fontSize.display, fontWeight: '800' },
    sub: { color: colors.text2, fontSize: fontSize.caption, marginTop: 2 },
    refresh: { color: colors.text2, fontSize: 20 },
    error: {
      color: colors.danger,
      paddingBottom: spacing.sm,
      fontSize: fontSize.label,
    },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    emptyText: { color: colors.text2, fontSize: fontSize.label },

    pastEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderColor: colors.borderMd,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginTop: spacing.sm,
    },
    pastEntryTitle: { color: colors.text1, fontSize: fontSize.body, fontWeight: '700' },
    pastEntrySub: { color: colors.text2, fontSize: fontSize.caption, marginTop: 2 },
    pastEntryChev: { color: colors.text2, fontSize: 22 },
  });
