import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MyVoteEntryDto } from '@a-idol/shared';
import { api } from '../../../src/api/client';
import { useAuth } from '../../../src/auth/AuthContext';
import { InlineErrorLine } from '../../../src/components/InlineErrorLine';
import { useMyVotes } from '../../../src/hooks/useMyVotes';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-023 투표 이력 — RPT-260426-C P4.
 *
 * `GET /me/votes` (paginated, 최신순). idol/round/audition 이름은 backend가
 * batch-hydrate. 삭제된 항목은 placeholder.
 */
export default function MyVotesScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const votes = useMyVotes(accessToken);

  const heroPrefix = useMemo(() => api.baseUrl.replace(/\/1$/, ''), []);
  const toUri = (path: string | null) =>
    !path ? null : path.startsWith('http') ? path : `${heroPrefix}${path}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>투표 이력</Text>
        <View style={{ width: 48 }} />
      </View>

      <Text style={styles.summary}>
        총 <Text style={{ color: colors.accent, fontWeight: '800' }}>{votes.total}</Text>회 투표
      </Text>
      <InlineErrorLine message={votes.error} requestId={votes.errorRequestId} />

      <FlatList
        data={votes.items}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={votes.refreshing}
            onRefresh={votes.refresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={votes.loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          votes.loading && votes.items.length > 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : !votes.hasMore && votes.items.length > 0 ? (
            <Text style={styles.endText}>— 끝 —</Text>
          ) : null
        }
        ListEmptyComponent={
          votes.refreshing || votes.loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>아직 투표한 적이 없습니다.</Text>
              <Pressable
                onPress={() => router.replace('/(app)/auditions')}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.ctaText}>오디션 둘러보기 →</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <VoteRow item={item} colors={colors} toUri={toUri} onPress={() =>
            router.push({ pathname: '/(app)/idol/[id]', params: { id: item.idolId } })
          } />
        )}
      />
    </SafeAreaView>
  );
}

function VoteRow({
  item,
  colors,
  toUri,
  onPress,
}: {
  item: MyVoteEntryDto;
  colors: ThemeColors;
  toUri: (p: string | null) => string | null;
  onPress: () => void;
}) {
  const heroUri = toUri(item.idolHeroImageUrl);
  const methodColor = item.method === 'TICKET' ? colors.accent : colors.danger;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {heroUri ? (
        <Image source={{ uri: heroUri }} style={rowStyles.thumb} resizeMode="cover" />
      ) : (
        <View style={[rowStyles.thumb, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
            {(item.idolStageName ?? item.idolName)[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ color: colors.text1, fontSize: fontSize.body, fontWeight: '700' }}
          numberOfLines={1}
        >
          {item.idolStageName ?? item.idolName}
        </Text>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption }} numberOfLines={1}>
          {item.auditionName} · {item.roundName}
        </Text>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <View
          style={{
            backgroundColor: methodColor,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ color: '#fff', fontSize: fontSize.caption, fontWeight: '800' }}>
            {item.method === 'TICKET' ? '🎟' : '❤'} {item.method}
          </Text>
        </View>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption, fontWeight: '700' }}>
          ×{item.weight}
        </Text>
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  thumb: { width: 48, height: 48, borderRadius: radius.sm },
});

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
    title: { color: colors.text1, fontSize: fontSize.heading, fontWeight: '800' },
    summary: {
      color: colors.text2,
      fontSize: fontSize.label,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
    footer: { paddingVertical: spacing.lg, alignItems: 'center' },
    endText: {
      textAlign: 'center',
      paddingVertical: spacing.lg,
      fontSize: fontSize.caption,
      color: colors.text3,
    },
    empty: { paddingVertical: spacing.xxl * 2, alignItems: 'center', gap: spacing.lg },
    emptyText: { color: colors.text2, fontSize: fontSize.label },
    cta: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    ctaText: { color: '#fff', fontSize: fontSize.body, fontWeight: '800' },
  });
