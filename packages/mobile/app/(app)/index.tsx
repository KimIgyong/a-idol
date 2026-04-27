import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IdolCardDto } from '@a-idol/shared';
import { api, type IdolsSort } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { useIdolsList } from '../../src/hooks/useIdolsList';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontSize, radius, spacing } from '../../src/theme/tokens';

const SORTS: { key: IdolsSort; label: string }[] = [
  { key: 'popularity', label: '인기' },
  { key: 'new', label: '최신' },
  { key: 'name', label: '이름순' },
];

/**
 * SCR-005 홈 피드 — view-mode 3종 (RPT-260426-C P2).
 *  - `grid2` : 2열 카드 (와이어프레임 default)
 *  - `card1` : 1열 풀 너비 큰 카드 — heart/follow 더 강조
 *  - `list`  : 컴팩트 한 줄 항목 — 빠른 스캔
 *
 * 선택은 AsyncStorage 영속 (`@a-idol/home/view-mode/v1`).
 */
type ViewMode = 'grid2' | 'card1' | 'list';
const VIEW_MODE_KEY = '@a-idol/home/view-mode/v1';
const DEFAULT_MODE: ViewMode = 'grid2';

const VIEW_MODES: { key: ViewMode; label: string; icon: string }[] = [
  { key: 'grid2', label: '2열', icon: '▦' },
  { key: 'card1', label: '카드', icon: '▭' },
  { key: 'list', label: '목록', icon: '☰' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const list = useIdolsList(accessToken);
  const { colors } = useTheme();
  const [mode, setMode] = useState<ViewMode>(DEFAULT_MODE);
  const heroPrefix = useMemo(() => api.baseUrl.replace(/\/1$/, ''), []);

  // boot — 저장된 view-mode 복원.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIEW_MODE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'grid2' || stored === 'card1' || stored === 'list') {
          setMode(stored);
        }
      })
      .catch(() => {
        // 저장 실패는 무시 — default로 시작.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setModeAndPersist = (next: ViewMode) => {
    setMode(next);
    void AsyncStorage.setItem(VIEW_MODE_KEY, next);
  };

  const renderItem: ListRenderItem<IdolCardDto> = ({ item }) => {
    const onPress = () => router.push(`/(app)/idol/${item.id}`);
    const heroUri = resolveHero(item.heroImageUrl, heroPrefix);
    if (mode === 'grid2') return <Grid2Card item={item} heroUri={heroUri} onPress={onPress} />;
    if (mode === 'card1') return <Card1 item={item} heroUri={heroUri} onPress={onPress} />;
    return <ListRow item={item} heroUri={heroUri} onPress={onPress} />;
  };

  const numColumns = mode === 'grid2' ? 2 : 1;
  const columnWrapperStyle = mode === 'grid2' ? { gap: spacing.md } : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.hi, { color: colors.text2 }]}>안녕하세요</Text>
          <Text style={[styles.name, { color: colors.text1 }]}>{user?.nickname ?? '팬'} 님</Text>
        </View>
        <Pressable
          onPress={list.refresh}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="새로 고침"
        >
          <Text style={[styles.refresh, { color: colors.text2 }]}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.sortRow}>
          {SORTS.map((s) => {
            const active = list.sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => list.setSort(s.key)}
                accessibilityRole="button"
                accessibilityLabel={`정렬: ${s.label}`}
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.accent : colors.bg,
                    borderColor: active ? colors.accent : colors.borderMd,
                  },
                ]}
              >
                <Text
                  style={[styles.chipLabel, { color: active ? '#fff' : colors.text2 }]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.viewToggle, { backgroundColor: colors.bg, borderColor: colors.borderMd }]}>
          {VIEW_MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setModeAndPersist(m.key)}
                accessibilityRole="button"
                accessibilityLabel={`보기 모드: ${m.label}`}
                accessibilityState={{ selected: active }}
                style={[
                  styles.viewBtn,
                  active && { backgroundColor: colors.accentLt },
                ]}
                hitSlop={4}
              >
                <Text style={[styles.viewIcon, { color: active ? colors.accent : colors.text2 }]}>{m.icon}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {list.error ? (
        <Text style={[styles.error, { color: colors.danger }]}>⚠ {list.error}</Text>
      ) : null}

      <FlatList
        // FlatList의 numColumns는 동적 변경 시 key 재마운트 필요.
        key={mode}
        data={list.items}
        keyExtractor={(i) => i.id}
        numColumns={numColumns}
        columnWrapperStyle={columnWrapperStyle}
        contentContainerStyle={[styles.list, mode === 'list' && { gap: 0 }]}
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={list.refresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          list.loading && list.items.length > 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : !list.hasMore && list.items.length > 0 ? (
            <Text style={[styles.endText, { color: colors.text2 }]}>— 끝 —</Text>
          ) : null
        }
        ListEmptyComponent={
          list.refreshing ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={{ color: colors.text2 }}>아직 공개된 아이돌이 없습니다.</Text>
            </View>
          )
        }
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

function resolveHero(heroImageUrl: string | null, prefix: string): string | null {
  if (!heroImageUrl) return null;
  return heroImageUrl.startsWith('http') ? heroImageUrl : `${prefix}${heroImageUrl}`;
}

function Grid2Card({ item, heroUri, onPress }: { item: IdolCardDto; heroUri: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        gridStyles.card,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {heroUri ? (
        <Image source={{ uri: heroUri }} style={gridStyles.hero} resizeMode="cover" />
      ) : (
        <View style={[gridStyles.heroFallback, { backgroundColor: colors.accent }]}>
          <Text style={gridStyles.heroFallbackText}>
            {(item.stageName ?? item.name)[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={gridStyles.body}>
        <Text style={[gridStyles.title, { color: colors.text1 }]} numberOfLines={1}>
          {item.stageName ?? item.name}
        </Text>
        <Text style={[gridStyles.meta, { color: colors.text2 }]}>
          ❤ {item.heartCount.toLocaleString()}
        </Text>
      </View>
    </Pressable>
  );
}

function Card1({ item, heroUri, onPress }: { item: IdolCardDto; heroUri: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        cardStyles.card,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {heroUri ? (
        <Image source={{ uri: heroUri }} style={cardStyles.hero} resizeMode="cover" />
      ) : (
        <View style={[cardStyles.heroFallback, { backgroundColor: colors.accent }]}>
          <Text style={cardStyles.heroFallbackText}>
            {(item.stageName ?? item.name)[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={cardStyles.body}>
        <Text style={[cardStyles.title, { color: colors.text1 }]} numberOfLines={1}>
          {item.stageName ?? item.name}
        </Text>
        {item.stageName && item.stageName !== item.name ? (
          <Text style={[cardStyles.sub, { color: colors.text2 }]} numberOfLines={1}>
            {item.name}
          </Text>
        ) : null}
        <Text style={[cardStyles.meta, { color: colors.text2 }]}>
          ❤ {item.heartCount.toLocaleString()} · 👥 {item.followCount.toLocaleString()}
        </Text>
      </View>
    </Pressable>
  );
}

function ListRow({ item, heroUri, onPress }: { item: IdolCardDto; heroUri: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {heroUri ? (
        <Image source={{ uri: heroUri }} style={rowStyles.hero} resizeMode="cover" />
      ) : (
        <View style={[rowStyles.heroFallback, { backgroundColor: colors.accent }]}>
          <Text style={rowStyles.heroFallbackText}>
            {(item.stageName ?? item.name)[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.title, { color: colors.text1 }]} numberOfLines={1}>
          {item.stageName ?? item.name}
        </Text>
        <Text style={[rowStyles.meta, { color: colors.text2 }]}>
          ❤ {item.heartCount.toLocaleString()} · 👥 {item.followCount.toLocaleString()}
        </Text>
      </View>
      <Text style={[rowStyles.chev, { color: colors.text3 }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  hi: { fontSize: fontSize.body },
  name: { fontSize: fontSize.display, fontWeight: '800' },
  refresh: { fontSize: 20 },

  controls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sortRow: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { fontSize: fontSize.label, fontWeight: '600' },

  viewToggle: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 2,
  },
  viewBtn: {
    width: 32,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewIcon: { fontSize: 14, fontWeight: '700' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  error: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },

  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  endText: { textAlign: 'center', paddingVertical: spacing.lg, fontSize: fontSize.caption },
  emptyWrap: { paddingVertical: spacing.xxl * 2, alignItems: 'center' },
});

const gridStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hero: { width: '100%', aspectRatio: 1, backgroundColor: '#00000010' },
  heroFallback: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  heroFallbackText: { color: '#fff', fontSize: 38, fontWeight: '800' },
  body: { padding: spacing.md, gap: 2 },
  title: { fontSize: fontSize.body, fontWeight: '700' },
  meta: { fontSize: fontSize.caption },
});

const cardStyles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hero: { width: '100%', height: 180, backgroundColor: '#00000010' },
  heroFallback: { width: '100%', height: 180, alignItems: 'center', justifyContent: 'center' },
  heroFallbackText: { color: '#fff', fontSize: 56, fontWeight: '800' },
  body: { padding: spacing.lg, gap: 4 },
  title: { fontSize: fontSize.heading, fontWeight: '700' },
  sub: { fontSize: fontSize.caption },
  meta: { fontSize: fontSize.label, marginTop: 4 },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  hero: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: '#00000010' },
  heroFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallbackText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  title: { fontSize: fontSize.body, fontWeight: '700' },
  meta: { fontSize: fontSize.caption, marginTop: 2 },
  chev: { fontSize: 20 },
});
