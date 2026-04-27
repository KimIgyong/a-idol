import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LeaderboardEntryDto, VoteMethod } from '@a-idol/shared';
import { api } from '../../../../src/api/client';
import { useAuth } from '../../../../src/auth/AuthContext';
import { InlineErrorLine } from '../../../../src/components/InlineErrorLine';
import { useMyVoteTickets } from '../../../../src/hooks/useCommerce';
import {
  useCastVote,
  useLeaderboard,
  useMyVoteStatus,
} from '../../../../src/hooks/useVote';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../../src/theme/tokens';

/**
 * Round vote 화면 — RPT-260426-D Phase D 토큰 마이그레이션 + a11y.
 *
 * leaderboard rank list + per-entry HEART/TICKET 투표 버튼. 라운드 status,
 * heart 한도, ticket 잔액 모두 a11y 라벨링.
 */
export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: board, refresh } = useLeaderboard(id);
  const { data: status, refresh: refreshStatus } = useMyVoteStatus(id, accessToken);
  const { data: tickets, refresh: refreshTickets } = useMyVoteTickets(accessToken);
  const { cast, busy, error, errorRequestId } = useCastVote(id, accessToken);

  const heroPrefix = useMemo(() => api.baseUrl.replace(/\/1$/, ''), []);
  const toUri = (p: string | null) =>
    !p ? null : p.startsWith('http') ? p : `${heroPrefix}${p}`;

  const handleVote = async (idolId: string, method: VoteMethod) => {
    const res = await cast(idolId, method);
    if (res) {
      await Promise.all([refresh(), refreshStatus(), refreshTickets()]);
    }
  };

  const heartsLeft = status ? status.dailyLimit - status.dailyUsed : null;
  const roundTickets = useMemo(
    () => (tickets?.roundBalances ?? []).find((r) => r.roundId === id)?.balance ?? 0,
    [tickets, id],
  );
  const globalTickets = tickets?.balance ?? 0;
  const totalTickets = roundTickets + globalTickets;
  const roundActive = board?.status === 'ACTIVE';
  const canHeart = roundActive && (heartsLeft === null || heartsLeft > 0);
  const canTicket = roundActive && totalTickets > 0;

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
        <View style={styles.statusRow}>
          <View
            style={styles.badge}
            accessibilityLabel={`하트 사용 ${status?.dailyUsed ?? 0} / ${status?.dailyLimit ?? 0}`}
          >
            <Text style={styles.badgeText}>
              ❤ {status ? `${status.dailyUsed}/${status.dailyLimit}` : '…'}
            </Text>
          </View>
          <View
            style={styles.badge}
            accessibilityLabel={
              roundTickets > 0
                ? `투표권 ${totalTickets}매, 라운드 전용 ${roundTickets}매 + 글로벌 ${globalTickets}매`
                : `투표권 ${totalTickets}매`
            }
          >
            <Text style={styles.badgeText}>
              🎟 {totalTickets}
              {roundTickets > 0 ? (
                <Text style={styles.badgeSub}> ({roundTickets}+{globalTickets})</Text>
              ) : null}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.heading}>
        <Text style={styles.title}>투표</Text>
        <Text style={styles.sub}>
          {roundActive
            ? `하트 ${heartsLeft ?? '…'}개 · 투표권 ${totalTickets}매`
            : `라운드 상태: ${board?.status ?? '…'}`}
        </Text>
        {roundActive && roundTickets > 0 ? (
          <Text style={styles.subHint}>
            🎟 {roundTickets}매는 이 라운드 전용 (먼저 소진) · 글로벌 {globalTickets}매
          </Text>
        ) : null}
      </View>

      <View style={styles.errorBlock}>
        <InlineErrorLine message={error} requestId={errorRequestId} />
      </View>

      <FlatList
        data={board?.entries ?? []}
        keyExtractor={(e) => e.idolId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          !board ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          board && board.entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>아직 투표가 없습니다. 첫 번째 투표를 해보세요!</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <EntryRow
            entry={item}
            busy={busy}
            canHeart={canHeart}
            canTicket={canTicket}
            onVote={(m) => handleVote(item.idolId, m)}
            toUri={toUri}
            colors={colors}
            styles={styles}
          />
        )}
      />
    </SafeAreaView>
  );
}

function EntryRow({
  entry,
  busy,
  canHeart,
  canTicket,
  onVote,
  toUri,
  colors,
  styles,
}: {
  entry: LeaderboardEntryDto;
  busy: boolean;
  canHeart: boolean;
  canTicket: boolean;
  onVote: (method: VoteMethod) => void;
  toUri: (p: string | null) => string | null;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const heroUri = toUri(entry.heroImageUrl);
  const displayName = entry.stageName ?? entry.idolName;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${entry.rank}위 ${displayName}, 점수 ${entry.score.toLocaleString()}`}
    >
      <View style={styles.rank}>
        <Text style={styles.rankText}>#{entry.rank}</Text>
      </View>
      {heroUri ? (
        <Image source={{ uri: heroUri }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatarWrap, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{displayName[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{displayName}</Text>
        <Text style={styles.rowScore}>🔥 {entry.score.toLocaleString()}</Text>
      </View>
      <View style={styles.voteBtns}>
        <Pressable
          onPress={() => onVote('HEART')}
          disabled={!canHeart || busy}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}에게 하트 투표`}
          accessibilityState={{ disabled: !canHeart || busy, busy }}
          style={({ pressed }) => [
            styles.voteBtn,
            (!canHeart || busy) && styles.voteBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.voteBtnText}>❤</Text>
        </Pressable>
        <Pressable
          onPress={() => onVote('TICKET')}
          disabled={!canTicket || busy}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}에게 투표권 사용`}
          accessibilityState={{ disabled: !canTicket || busy, busy }}
          style={({ pressed }) => [
            styles.voteBtn,
            styles.voteBtnTicket,
            (!canTicket || busy) && styles.voteBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.voteBtnText}>🎟</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.pageBg },
    topbar: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    back: { color: colors.text2, fontSize: fontSize.title },
    statusRow: { flexDirection: 'row', gap: spacing.xs },
    badge: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
    },
    badgeText: { color: colors.text2, fontSize: fontSize.label, fontWeight: '600' },
    badgeSub: { color: colors.accent2, fontSize: 10, fontWeight: '700' },
    heading: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
    title: { color: colors.text1, fontSize: fontSize.display, fontWeight: '800' },
    sub: { color: colors.text2, fontSize: fontSize.label, marginTop: 2 },
    subHint: { color: colors.accent2, fontSize: fontSize.label, marginTop: 4, fontWeight: '600' },
    errorBlock: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    rank: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: { color: colors.text1, fontSize: fontSize.label, fontWeight: '800' },
    avatarWrap: { width: 44, height: 44, borderRadius: radius.md, overflow: 'hidden' },
    avatarFallback: {
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    avatar: { width: 44, height: 44, borderRadius: radius.md },
    rowBody: { flex: 1 },
    rowName: { color: colors.text1, fontSize: fontSize.body, fontWeight: '700' },
    rowScore: { color: colors.text2, fontSize: fontSize.label, marginTop: 2 },

    voteBtns: { flexDirection: 'row', gap: spacing.xs },
    voteBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voteBtnTicket: { backgroundColor: colors.accent2 },
    voteBtnDisabled: { opacity: 0.4 },
    voteBtnText: { color: '#fff', fontSize: 18 },

    center: { alignItems: 'center', paddingVertical: spacing.xxl },
    empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
    emptyText: { color: colors.text2, textAlign: 'center' },
  });
