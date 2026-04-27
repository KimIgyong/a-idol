import { useRouter } from 'expo-router';
import { useMemo } from 'react';
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
import type { AuditionListItemDto } from '@a-idol/shared';
import { useAuditionsList } from '../../../src/hooks/useAuditions';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-012 지난 오디션 — RPT-260426-C P3.
 *
 * `?status=FINISHED` 로 backend에서 filter. endAt DESC. Tap → detail (now
 * accepts FINISHED).
 */
export default function AuditionsPastScreen() {
  const router = useRouter();
  const { items, loading, error, refresh } = useAuditionsList('FINISHED');
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
        <Text style={styles.title}>지난 오디션</Text>
        <View style={{ width: 48 }} />
      </View>

      {error ? <Text style={styles.error}>⚠ {error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>완료된 오디션이 없습니다.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PastRow
            item={item}
            colors={colors}
            onPress={() =>
              router.push({ pathname: '/(app)/auditions/[id]', params: { id: item.id } })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

function PastRow({
  item,
  colors,
  onPress,
}: {
  item: AuditionListItemDto;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`종료된 오디션 ${item.name}, 참가 ${item.entries}명`}
      accessibilityHint="결과 보기로 이동합니다."
      style={({ pressed }) => [
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              backgroundColor: colors.text2,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.sm,
            }}
          >
            <Text style={{ color: '#fff', fontSize: fontSize.caption, fontWeight: '800' }}>
              종료
            </Text>
          </View>
          <Text style={{ color: colors.text1, fontSize: fontSize.body, fontWeight: '700' }} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
          {new Date(item.startAt).toLocaleDateString()} → {new Date(item.endAt).toLocaleDateString()}
        </Text>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
          🎤 참가 {item.entries} · 🏁 라운드 {item.rounds}
        </Text>
      </View>
      <Text style={{ color: colors.text3, fontSize: 20 }}>›</Text>
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
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    empty: { paddingVertical: spacing.xxl * 2, alignItems: 'center' },
    emptyText: { color: colors.text3, fontSize: fontSize.label },
  });
