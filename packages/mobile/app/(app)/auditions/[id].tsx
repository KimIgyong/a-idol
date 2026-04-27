import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RoundDto } from '@a-idol/shared';
import { useAudition } from '../../../src/hooks/useAuditions';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-011 진행중 오디션 + SCR-012 지난 오디션 공용 detail (RPT-260426-C P3).
 *
 * Backend는 ACTIVE/FINISHED 둘 다 public read 허용 (DRAFT/CANCELED만 차단).
 * 회차 카드 → ACTIVE면 투표 진입, CLOSED면 leaderboard 진입 (SCR-012 결과).
 */
export default function AuditionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { audition, loading, error } = useAudition(id);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
      </View>

      {loading || !audition ? (
        <View style={styles.center}>
          {error ? (
            <Text style={styles.error}>⚠ {error}</Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{audition.name}</Text>
          <View style={styles.metaRow}>
            <StatusBadge label={audition.status} colors={colors} />
            <Text style={styles.meta}>
              {new Date(audition.startAt).toLocaleDateString()} →{' '}
              {new Date(audition.endAt).toLocaleDateString()}
            </Text>
          </View>
          {audition.description ? (
            <Text style={styles.description}>{audition.description}</Text>
          ) : null}

          <Section title={`참가자 (${audition.entries.length})`} colors={colors}>
            <View style={styles.entries}>
              {audition.entries.map((e) => (
                <View key={e.idolId} style={styles.entryChip}>
                  <Text style={styles.entryText}>{e.stageName ?? e.idolName}</Text>
                  {e.eliminatedAt ? <Text style={styles.eliminated}>탈락</Text> : null}
                </View>
              ))}
            </View>
          </Section>

          <Section title={`라운드 (${audition.rounds.length})`} colors={colors}>
            {audition.rounds.length === 0 ? (
              <Text style={styles.emptyText}>등록된 라운드가 없습니다.</Text>
            ) : (
              <View style={styles.roundsList}>
                {audition.rounds.map((r) => (
                  <RoundCard
                    key={r.id}
                    round={r}
                    colors={colors}
                    onVote={() =>
                      router.push({
                        pathname: '/(app)/rounds/[id]/vote',
                        params: { id: r.id },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </Section>
        </ScrollView>
      )}
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

function StatusBadge({ label, colors }: { label: string; colors: ThemeColors }) {
  const bg =
    label === 'ACTIVE'
      ? colors.success
      : label === 'FINISHED'
        ? colors.text2
        : colors.elevated;
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: '#fff', fontSize: fontSize.caption, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

function RoundCard({
  round,
  colors,
  onVote,
}: {
  round: RoundDto;
  colors: ThemeColors;
  onVote: () => void;
}) {
  const canVote = round.status === 'ACTIVE';
  const bg =
    round.status === 'ACTIVE'
      ? colors.success
      : round.status === 'CLOSED'
        ? colors.accentSk
        : colors.elevated;
  return (
    <Pressable
      onPress={canVote ? onVote : undefined}
      accessibilityRole={canVote ? 'link' : 'text'}
      accessibilityLabel={`#${round.orderIndex} ${round.name}, ${round.status}`}
      accessibilityHint={canVote ? '투표 페이지로 이동합니다.' : undefined}
      accessibilityState={{ disabled: !canVote }}
      style={({ pressed }) => [
        {
          backgroundColor: colors.bg,
          borderColor: canVote ? colors.accent : colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: 4,
          opacity: pressed && canVote ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text1, fontSize: fontSize.body, fontWeight: '700' }}>
          #{round.orderIndex} {round.name}
        </Text>
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
            backgroundColor: bg,
          }}
        >
          <Text style={{ color: '#fff', fontSize: fontSize.caption, fontWeight: '800' }}>
            {round.status}
          </Text>
        </View>
      </View>
      <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
        {new Date(round.startAt).toLocaleString()} →{' '}
        {new Date(round.endAt).toLocaleString()}
      </Text>
      {round.maxAdvancers ? (
        <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
          진출자 {round.maxAdvancers}명
        </Text>
      ) : null}
      {canVote ? (
        <Text style={{ color: colors.accent, fontSize: fontSize.body, fontWeight: '800', marginTop: spacing.xs }}>
          ❤ 투표하러 가기 →
        </Text>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.pageBg },
    topbar: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    back: { color: colors.text2, fontSize: fontSize.title },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    title: { color: colors.text1, fontSize: fontSize.display + 4, fontWeight: '800' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    meta: { color: colors.text2, fontSize: fontSize.caption },
    description: { color: colors.text1, fontSize: fontSize.body, lineHeight: 20 },
    error: { color: colors.danger, textAlign: 'center' },
    emptyText: { color: colors.text2, fontSize: fontSize.label },

    entries: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    entryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
    },
    entryText: { color: colors.text1, fontSize: fontSize.caption, fontWeight: '600' },
    eliminated: { color: colors.danger, fontSize: 10, fontWeight: '800' },

    roundsList: { gap: spacing.sm },
  });
