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
import type { PhotocardSetDto, PurchaseProductDto } from '@a-idol/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { InlineErrorLine } from '../../src/components/InlineErrorLine';
import { useChatBalance } from '../../src/hooks/useChatBalance';
import {
  useMyVoteTickets,
  useProducts,
  usePurchase,
} from '../../src/hooks/useCommerce';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../src/theme/tokens';

/**
 * 상점 — RPT-260426-D Phase D 토큰 마이그레이션 + a11y.
 *
 *  - 5테마 토큰 기반 (deprecated `colors` 제거)
 *  - 탭(투표권/쿠폰/포토카드) selected state, refresh/buy/toast a11y
 *  - 확률 공개 toggle expanded state
 */

type Tab = 'VOTE_TICKET' | 'CHAT_COUPON' | 'PHOTOCARD_PACK';

const TAB_LABEL: Record<Tab, string> = {
  VOTE_TICKET: '투표권',
  CHAT_COUPON: '채팅 쿠폰',
  PHOTOCARD_PACK: '포토카드',
};

type ToastState = { text: string; cta?: 'collection' } | null;

export default function ShopScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const products = useProducts();
  const tickets = useMyVoteTickets(accessToken);
  const chat = useChatBalance(accessToken);
  const purchase = usePurchase(accessToken);
  const [tab, setTab] = useState<Tab>('VOTE_TICKET');
  const [toast, setToast] = useState<ToastState>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const visible = useMemo(
    () => (products.data ?? []).filter((p) => p.isActive && p.kind === tab),
    [products.data, tab],
  );

  const handleBuy = async (product: PurchaseProductDto) => {
    const tx = await purchase.buy(product.id);
    if (!tx) return;
    if (tx.status === 'FULFILLED') {
      if (product.kind === 'PHOTOCARD_PACK') {
        setToast({ text: `${product.title} 구매 완료`, cta: 'collection' });
      } else {
        setToast({ text: `${product.title} 구매 완료` });
      }
      if (product.kind === 'VOTE_TICKET') await tickets.refresh();
      if (product.kind === 'CHAT_COUPON') await chat.refresh();
    } else {
      setToast({ text: `${product.title} · ${tx.status}` });
    }
    // Photocard toast gets a longer window so the CTA is tappable.
    const dwell = product.kind === 'PHOTOCARD_PACK' ? 4500 : 2200;
    setTimeout(() => setToast(null), dwell);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>상점</Text>
        <Pressable
          onPress={() => {
            void products.refresh();
            void tickets.refresh();
            void chat.refresh();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="상점 새로 고침"
        >
          <Text style={styles.refresh}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.balanceRow}>
        <Balance
          label="투표권"
          value={
            (tickets.data?.balance ?? 0) +
            (tickets.data?.roundBalances ?? []).reduce((s, r) => s + r.balance, 0)
          }
          emoji="🎟"
          colors={colors}
        />
        <Balance
          label="채팅 쿠폰"
          value={chat.balance?.couponBalance ?? 0}
          emoji="💬"
          colors={colors}
        />
      </View>

      <View style={styles.tabs}>
        {(Object.keys(TAB_LABEL) as Tab[]).map((k) => {
          const active = k === tab;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="button"
              accessibilityLabel={`${TAB_LABEL[k]} 탭`}
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {TAB_LABEL[k]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.errorBlock}>
        <InlineErrorLine message={products.error} requestId={null} />
        <InlineErrorLine
          message={purchase.error}
          requestId={purchase.errorRequestId}
        />
      </View>
      {toast ? (
        <Pressable
          onPress={() => {
            if (toast.cta === 'collection') {
              setToast(null);
              router.push('/(app)/collection');
            }
          }}
          accessibilityRole={toast.cta === 'collection' ? 'link' : 'text'}
          accessibilityLabel={toast.text}
          accessibilityLiveRegion="polite"
          style={styles.toast}
        >
          <Text style={styles.toastText}>{toast.text}</Text>
          {toast.cta === 'collection' ? (
            <Text style={styles.toastCta}>내 컬렉션에서 확인하기 →</Text>
          ) : null}
        </Pressable>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={products.loading}
            onRefresh={products.refresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          products.loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>판매 중인 상품이 없습니다.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ProductRow
            item={item}
            busy={purchase.busy}
            onBuy={() => handleBuy(item)}
            colors={colors}
            styles={styles}
          />
        )}
      />
    </SafeAreaView>
  );
}

function Balance({
  label,
  value,
  emoji,
  colors,
}: {
  label: string;
  value: number;
  emoji: string;
  colors: ThemeColors;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
      accessibilityLabel={`${label} 잔액 ${value.toLocaleString()}`}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <View>
        <Text style={{ color: colors.text2, fontSize: fontSize.label }}>{label}</Text>
        <Text style={{ color: colors.text1, fontSize: 18, fontWeight: '800' }}>
          {value.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

function ProductRow({
  item,
  busy,
  onBuy,
  colors,
  styles,
}: {
  item: PurchaseProductDto;
  busy: boolean;
  onBuy: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const payload = item.deliveryPayload as {
    ticketAmount?: number;
    couponAmount?: number;
    count?: number;
    setId?: string;
  };
  const metaText = (() => {
    if (item.kind === 'VOTE_TICKET') return `🎟 ${payload.ticketAmount ?? 0}매`;
    if (item.kind === 'CHAT_COUPON') return `💬 ${payload.couponAmount ?? 0}매`;
    return `📇 ${payload.count ?? 0}장 · 가중 랜덤`;
  })();

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>{metaText}</Text>
        </View>
        <Pressable
          onPress={onBuy}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${item.title} 구매, ${item.priceKrw.toLocaleString()}원`}
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [
            styles.buyBtn,
            busy && styles.buyBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.buyBtnText}>{item.priceKrw.toLocaleString()}₩</Text>
        </Pressable>
      </View>
      {item.kind === 'PHOTOCARD_PACK' && payload.setId ? (
        <DropRates setId={payload.setId} colors={colors} styles={styles} />
      ) : null}
    </View>
  );
}

/**
 * 확률 공개 legend (ADR-016). Lazy hydrate — set 작아 row mount 시 한 번 fetch.
 */
function DropRates({
  setId,
  colors,
  styles,
}: {
  setId: string;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [set, setSet] = useState<PhotocardSetDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      setSet(await api.getPhotocardSet(setId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Text style={styles.rateError}>⚠ 확률 로드 실패: {error}</Text>;
  if (!set) return <Text style={styles.rateHint}>확률 불러오는 중…</Text>;

  const sorted = [...set.templates]
    .filter((t) => t.isActive)
    .sort((a, b) => b.dropWeight - a.dropWeight);

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? '확률 공개 닫기' : '확률 공개 열기'}
        accessibilityState={{ expanded }}
        style={styles.rateToggle}
      >
        <Text style={styles.rateToggleText}>
          📊 확률 공개 (합계 100%) {expanded ? '▾' : '▸'}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={styles.rateList}>
          {sorted.map((t) => (
            <View key={t.id} style={styles.rateRow}>
              <Text style={styles.rateName}>{t.name}</Text>
              <Text style={[styles.rateBadge, rarityStyle(t.rarity, colors)]}>{t.rarity}</Text>
              <Text style={styles.ratePct}>{t.dropPercent.toFixed(2)}%</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function rarityStyle(rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY', colors: ThemeColors) {
  switch (rarity) {
    case 'LEGENDARY':
      return { color: '#fbbf24' };
    case 'EPIC':
      return { color: '#a855f7' };
    case 'RARE':
      return { color: '#60a5fa' };
    default:
      return { color: colors.text2 };
  }
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.pageBg },
    header: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { color: colors.text1, fontSize: fontSize.display, fontWeight: '800' },
    refresh: { color: colors.text2, fontSize: 20 },

    balanceRow: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },

    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    tabLabel: { color: colors.text2, fontSize: fontSize.label, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },

    errorBlock: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    toast: {
      backgroundColor: colors.elevated,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    toastText: { color: colors.text1, fontSize: fontSize.label, textAlign: 'center' },
    toastCta: { color: colors.accent, fontSize: fontSize.label, fontWeight: '700' },

    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardBody: { flex: 1 },
    cardTitle: { color: colors.text1, fontSize: fontSize.title, fontWeight: '700' },
    cardMeta: { color: colors.text2, fontSize: fontSize.label, marginTop: 2 },
    buyBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    buyBtnDisabled: { opacity: 0.4 },
    buyBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: '800' },

    rateToggle: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
    },
    rateToggleText: { color: colors.text2, fontSize: fontSize.label, fontWeight: '600' },
    rateHint: { color: colors.text2, fontSize: fontSize.label },
    rateError: { color: colors.danger, fontSize: fontSize.label },
    rateList: {
      marginTop: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.bg,
      borderRadius: radius.sm,
      gap: spacing.xs,
    },
    rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rateName: { flex: 1, color: colors.text1, fontSize: fontSize.label },
    rateBadge: { fontSize: 10, fontWeight: '800', width: 70 },
    ratePct: {
      color: colors.text2,
      fontSize: fontSize.label,
      fontWeight: '700',
      width: 60,
      textAlign: 'right',
    },

    center: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
    emptyText: { color: colors.text2 },
  });
