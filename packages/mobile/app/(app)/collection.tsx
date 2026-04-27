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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhotocardRarity, UserPhotocardDto } from '@a-idol/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { useMyPhotocards } from '../../src/hooks/useCommerce';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../src/theme/tokens';

type RarityFilter = 'ALL' | PhotocardRarity;
type ViewMode = 'grid3' | 'list';

const FILTERS: { key: RarityFilter; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'LEGENDARY', label: 'LEGENDARY' },
  { key: 'EPIC', label: 'EPIC' },
  { key: 'RARE', label: 'RARE' },
  { key: 'COMMON', label: 'COMMON' },
];

const VIEW_MODES: { key: ViewMode; icon: string }[] = [
  { key: 'grid3', icon: '▦' },
  { key: 'list', icon: '☰' },
];

const VIEW_MODE_KEY = '@a-idol/collection/view-mode/v1';

/**
 * SCR-018 포토카드 전체 목록 — RPT-260426-C P3.
 *
 *  - 토큰 마이그레이션
 *  - rarity filter chip (ALL/LEGENDARY/EPIC/RARE/COMMON)
 *  - view-mode 토글: 3-열 grid (default) / list
 *  - 빈 상태 → 상점 또는 gacha 진입점
 */
export default function CollectionScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { data, loading, error, refresh } = useMyPhotocards(accessToken);
  const [filter, setFilter] = useState<RarityFilter>('ALL');
  const [mode, setMode] = useState<ViewMode>('grid3');
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heroPrefix = useMemo(() => api.baseUrl.replace(/\/1$/, ''), []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIEW_MODE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'grid3' || stored === 'list') setMode(stored);
      })
      .catch(() => {
        // 무시 — default
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setModeAndPersist = (next: ViewMode) => {
    setMode(next);
    void AsyncStorage.setItem(VIEW_MODE_KEY, next);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'ALL') return data;
    return data.filter((c) => c.rarity === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const c = { ALL: 0, COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };
    for (const card of data ?? []) {
      c.ALL += card.count;
      c[card.rarity] += card.count;
    }
    return c;
  }, [data]);

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
        <Text style={styles.title}>내 포토카드</Text>
        <Pressable
          onPress={refresh}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="컬렉션 새로 고침"
        >
          <Text style={styles.refresh}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            const n = counts[f.key];
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityLabel={`희귀도 필터: ${f.label}, ${n}장`}
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.accent : colors.bg,
                    borderColor: active ? colors.accent : colors.borderMd,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: active ? '#fff' : colors.text2 }]}>
                  {f.label}{' '}
                  <Text style={{ color: active ? '#fff' : colors.text3, fontSize: 10 }}>{n}</Text>
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
                accessibilityLabel={`보기 모드: ${m.key === 'grid3' ? '3열 그리드' : '리스트'}`}
                accessibilityState={{ selected: active }}
                style={[styles.viewBtn, active && { backgroundColor: colors.accentLt }]}
                hitSlop={4}
              >
                <Text style={[styles.viewIcon, { color: active ? colors.accent : colors.text2 }]}>{m.icon}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={styles.error}>⚠ {error}</Text> : null}

      <FlatList
        // numColumns 동적 변경 시 key 재마운트 필요.
        key={mode}
        data={filtered}
        keyExtractor={(c) => c.templateId}
        numColumns={mode === 'grid3' ? 3 : 1}
        columnWrapperStyle={mode === 'grid3' ? styles.gridRow : undefined}
        contentContainerStyle={[
          styles.list,
          mode === 'list' && { gap: 0, paddingHorizontal: 0 },
        ]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {counts.ALL === 0 ? '아직 포토카드가 없어요' : `${filter} 없음`}
              </Text>
              {counts.ALL === 0 ? (
                <Pressable
                  onPress={() => router.replace('/(app)/shop')}
                  accessibilityRole="link"
                  accessibilityLabel="상점에서 팩 열기"
                  accessibilityHint="포토카드 팩을 구매할 수 있는 상점으로 이동합니다."
                  style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.shopBtnText}>🛒 상점에서 팩 열기</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => {
          if (mode === 'grid3') return <CardTile item={item} heroPrefix={heroPrefix} colors={colors} />;
          return <CardListRow item={item} heroPrefix={heroPrefix} colors={colors} />;
        }}
      />
    </SafeAreaView>
  );
}

function CardTile({
  item,
  heroPrefix,
  colors,
}: {
  item: UserPhotocardDto;
  heroPrefix: string;
  colors: ThemeColors;
}) {
  const imgUri = resolveImg(item.imageUrl, heroPrefix);
  const accent = rarityColor(item.rarity, colors);
  return (
    <View
      style={[
        tileStyles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: accent,
        },
      ]}
    >
      {imgUri ? (
        <Image source={{ uri: imgUri }} style={tileStyles.img} resizeMode="cover" />
      ) : (
        <View style={[tileStyles.img, tileStyles.fallback, { backgroundColor: accent }]}>
          <Text style={tileStyles.fallbackText}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      )}
      {item.count > 1 ? (
        <View style={tileStyles.countBadge}>
          <Text style={tileStyles.countBadgeText}>×{item.count}</Text>
        </View>
      ) : null}
      <View style={tileStyles.body}>
        <Text style={[tileStyles.name, { color: colors.text1 }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[tileStyles.rarity, { color: accent }]}>{item.rarity}</Text>
      </View>
    </View>
  );
}

function CardListRow({
  item,
  heroPrefix,
  colors,
}: {
  item: UserPhotocardDto;
  heroPrefix: string;
  colors: ThemeColors;
}) {
  const imgUri = resolveImg(item.imageUrl, heroPrefix);
  const accent = rarityColor(item.rarity, colors);
  return (
    <View
      style={[
        rowStyles.row,
        { borderBottomColor: colors.border, backgroundColor: colors.bg },
      ]}
    >
      {imgUri ? (
        <Image source={{ uri: imgUri }} style={[rowStyles.thumb, { borderColor: accent }]} resizeMode="cover" />
      ) : (
        <View
          style={[
            rowStyles.thumb,
            rowStyles.thumbFallback,
            { backgroundColor: accent, borderColor: accent },
          ]}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
            {item.name[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.name, { color: colors.text1 }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[rowStyles.set, { color: colors.text2 }]} numberOfLines={1}>
          {item.setName}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ color: accent, fontSize: fontSize.caption, fontWeight: '800' }}>
          {item.rarity}
        </Text>
        {item.count > 1 ? (
          <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
            ×{item.count}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function resolveImg(imageUrl: string | null, heroPrefix: string): string | null {
  if (!imageUrl) return null;
  return imageUrl.startsWith('http') ? imageUrl : `${heroPrefix}${imageUrl}`;
}

function rarityColor(r: PhotocardRarity, colors: ThemeColors): string {
  switch (r) {
    case 'LEGENDARY':
      return '#fbbf24';
    case 'EPIC':
      return '#a855f7';
    case 'RARE':
      return '#60a5fa';
    default:
      return colors.text2;
  }
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
    title: { color: colors.text1, fontSize: fontSize.heading, fontWeight: '800' },
    refresh: { color: colors.text2, fontSize: 20 },

    controls: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    filterRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    chipLabel: { fontSize: fontSize.caption, fontWeight: '700' },

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

    error: {
      color: colors.danger,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
      fontSize: fontSize.label,
    },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
    gridRow: { gap: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.sm },

    center: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
    empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.lg },
    emptyTitle: { color: colors.text2, fontSize: fontSize.body },
    shopBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    shopBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: '800' },
  });

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1 / 3,
    borderRadius: radius.md,
    borderWidth: 2,
    overflow: 'hidden',
  },
  img: { width: '100%', aspectRatio: 3 / 4 },
  countBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  body: { padding: spacing.xs + 2 },
  name: { fontSize: fontSize.caption, fontWeight: '700' },
  rarity: { fontSize: 9, fontWeight: '800', marginTop: 2 },
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
  thumb: { width: 48, height: 64, borderRadius: radius.sm, borderWidth: 2 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: fontSize.body, fontWeight: '700' },
  set: { fontSize: fontSize.caption, marginTop: 2 },
});
