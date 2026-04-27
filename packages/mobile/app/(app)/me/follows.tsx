import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
import type { IdolCardDto } from '@a-idol/shared';
import { api } from '../../../src/api/client';
import { useAuth } from '../../../src/auth/AuthContext';
import { useMyFollows, useMyHearts } from '../../../src/hooks/useMyFandom';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-024 찜한 아티스트 — RPT-260426-C P4.
 *
 * 한 화면에 두 탭: 팔로우(`/me/follows`) + 하트(`/me/hearts`). 백엔드는 각각
 * 분리 endpoint이지만 마이페이지 진입은 단일 카드로 노출 (P4 결정).
 */
type Tab = 'follows' | 'hearts';

const TAB_LABEL: Record<Tab, string> = {
  follows: '팔로우',
  hearts: '하트',
};

export default function MyFollowsHeartsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('follows');

  const follows = useMyFollows(accessToken);
  const hearts = useMyHearts(accessToken);

  const heroPrefix = useMemo(() => api.baseUrl.replace(/\/1$/, ''), []);
  const toUri = (path: string | null) =>
    !path ? null : path.startsWith('http') ? path : `${heroPrefix}${path}`;

  const active = tab === 'follows' ? follows : hearts;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>찜한 아티스트</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.tabs}>
        {(Object.keys(TAB_LABEL) as Tab[]).map((k) => {
          const isActive = k === tab;
          const cnt = k === 'follows' ? follows.total : hearts.total;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? colors.accent : colors.bg,
                  borderColor: isActive ? colors.accent : colors.borderMd,
                },
              ]}
            >
              <Text style={[styles.tabLabel, { color: isActive ? '#fff' : colors.text2 }]}>
                {TAB_LABEL[k]} · {cnt}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {active.error ? <Text style={styles.error}>⚠ {active.error}</Text> : null}

      <FlatList
        // tab 전환 시 layout 재마운트로 깜빡임 방지를 위해 key를 tab으로 둠.
        key={tab}
        data={active.items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={active.refreshing}
            onRefresh={active.refresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={active.loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          active.loading && active.items.length > 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : !active.hasMore && active.items.length > 0 ? (
            <Text style={styles.endText}>— 끝 —</Text>
          ) : null
        }
        ListEmptyComponent={
          active.refreshing ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'follows' ? '팔로우' : '하트'} 한 아이돌이 없습니다.
              </Text>
              <Pressable
                onPress={() => router.replace('/(app)/')}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.ctaText}>아이돌 둘러보기 →</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <FollowRow
            item={item}
            colors={colors}
            toUri={toUri}
            onPress={() =>
              router.push({ pathname: '/(app)/idol/[id]', params: { id: item.id } })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

function FollowRow({
  item,
  colors,
  toUri,
  onPress,
}: {
  item: IdolCardDto;
  colors: ThemeColors;
  toUri: (p: string | null) => string | null;
  onPress: () => void;
}) {
  const heroUri = toUri(item.heroImageUrl);
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
        <View
          style={[
            rowStyles.thumb,
            { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
            {(item.stageName ?? item.name)[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.text1, fontSize: fontSize.body, fontWeight: '700' }}
          numberOfLines={1}
        >
          {item.stageName ?? item.name}
        </Text>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
          ❤ {item.heartCount.toLocaleString()} · 👥 {item.followCount.toLocaleString()}
        </Text>
      </View>
      <Text style={{ color: colors.text3, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: radius.md },
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
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    tabLabel: { fontSize: fontSize.label, fontWeight: '700' },
    error: {
      color: colors.danger,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
      fontSize: fontSize.label,
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
