import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MembershipDto } from '@a-idol/shared';
import { api } from '../../../src/api/client';
import { useAuth } from '../../../src/auth/AuthContext';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-022 구독 정보 — RPT-260426-C P4.
 *
 * `/me/memberships` 는 active membership 만 (left_at IS NULL). MembershipDto는
 * sparse — idolId 만 들고 있어 카드 탭 시 `/idol/<id>` 로 이동해 hydrate.
 */
export default function MembershipsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<MembershipDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listMyMemberships(accessToken);
      setItems(res.items);
      setTotal(res.total ?? res.items.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>구독</Text>
        <View style={{ width: 48 }} />
      </View>

      {error ? <Text style={styles.error}>⚠ {error}</Text> : null}

      <Text style={styles.summary}>
        가입 중인 팬클럽 <Text style={{ color: colors.accent, fontWeight: '800' }}>{total}</Text>개
      </Text>

      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>가입한 팬클럽이 없습니다.</Text>
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
          <MembershipRow
            item={item}
            colors={colors}
            onPress={() =>
              router.push({ pathname: '/(app)/idol/[id]', params: { id: item.idolId } })
            }
            onChat={() =>
              router.push({ pathname: '/(app)/chat/[idolId]', params: { idolId: item.idolId } })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

function MembershipRow({
  item,
  colors,
  onPress,
  onChat,
}: {
  item: MembershipDto;
  colors: ThemeColors;
  onPress: () => void;
  onChat: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ color: '#fff', fontSize: fontSize.caption, fontWeight: '800' }}>
            {item.tier}
          </Text>
        </View>
        <Text
          style={{ color: colors.text2, fontSize: fontSize.caption, flex: 1 }}
          numberOfLines={1}
        >
          가입일 · {new Date(item.joinedAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={{ color: colors.text1, fontSize: fontSize.body }}>
        팬클럽 진입 →
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        <Pressable
          onPress={onChat}
          style={({ pressed }) => [
            {
              flex: 1,
              backgroundColor: colors.accent,
              borderRadius: radius.md,
              paddingVertical: spacing.sm + 2,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: fontSize.label }}>
            💬 채팅
          </Text>
        </Pressable>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            {
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.borderMd,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingVertical: spacing.sm + 2,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.text1, fontWeight: '700', fontSize: fontSize.label }}>
            상세 보기
          </Text>
        </Pressable>
      </View>
    </Pressable>
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
    title: { color: colors.text1, fontSize: fontSize.heading, fontWeight: '800' },
    error: {
      color: colors.danger,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
      fontSize: fontSize.label,
    },
    summary: {
      color: colors.text2,
      fontSize: fontSize.label,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
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
