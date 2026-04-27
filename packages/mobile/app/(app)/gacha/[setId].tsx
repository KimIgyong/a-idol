import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  PhotocardRarity,
  PhotocardSetDto,
  PurchaseProductDto,
  UserPhotocardDto,
} from '@a-idol/shared';
import { api } from '../../../src/api/client';
import { useAuth } from '../../../src/auth/AuthContext';
import { InlineErrorLine } from '../../../src/components/InlineErrorLine';
import { useProducts, usePurchase } from '../../../src/hooks/useCommerce';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-017 포토카드 뽑기 — RPT-260426-C P3.
 *
 * 한 set에 대한 single-page gacha:
 *  - set + templates (확률 공개) hydrate
 *  - 매칭되는 PHOTOCARD_PACK product 1건 자동 선택 (deliveryPayload.setId)
 *  - 뽑기 = `usePurchase.buy()` → fulfilled 시 `/me/photocards` baseline diff 로
 *    이번에 굴러 나온 card 추출 → Animated 카드 reveal.
 *
 *  Lottie 자산 미합류 — built-in `Animated` API의 scale + opacity + rotate로
 *  RPT-260426-C §6 fallback. 자산 합류 시 `RevealCard` swap 가능.
 */

type RevealedCard = {
  templateId: string;
  name: string;
  imageUrl: string | null;
  rarity: PhotocardRarity;
  dup: boolean;
};

type ToBaselineMap = Map<string, number>;

export default function GachaScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heroPrefix = useMemo(() => api.baseUrl.replace(/\/1$/, ''), []);
  const toUri = (path: string | null) =>
    !path ? null : path.startsWith('http') ? path : `${heroPrefix}${path}`;

  const products = useProducts();
  const purchase = usePurchase(accessToken);

  const [set, setSet] = useState<PhotocardSetDto | null>(null);
  const [setError, setSetError] = useState<string | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState<RevealedCard[] | null>(null);

  // Baseline 카드 보유량 — 1회차 뽑기 직전 snapshot.
  const baselineRef = useRef<ToBaselineMap>(new Map());

  // Set + templates fetch.
  useEffect(() => {
    if (!setId) return;
    let cancelled = false;
    api
      .getPhotocardSet(setId)
      .then((s) => {
        if (!cancelled) setSet(s);
      })
      .catch((e) => {
        if (!cancelled) setSetError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [setId]);

  // 첫 baseline snapshot — 토큰 있을 때만.
  useEffect(() => {
    if (!accessToken) return;
    api
      .listMyPhotocards(accessToken)
      .then((rows) => {
        baselineRef.current = toBaselineMap(rows);
      })
      .catch(() => {
        // 무시 — diff가 over-report 될 수 있지만 비차단.
      });
  }, [accessToken]);

  // 매칭 PHOTOCARD_PACK product (있으면 가장 저렴한 것 hint).
  const matchingProducts = useMemo(() => {
    if (!products.data || !setId) return [];
    return products.data
      .filter((p) => p.isActive && p.kind === 'PHOTOCARD_PACK')
      .filter((p) => (p.deliveryPayload as { setId?: string })?.setId === setId)
      .sort((a, b) => a.priceKrw - b.priceKrw);
  }, [products.data, setId]);

  const handleDraw = useCallback(
    async (product: PurchaseProductDto) => {
      if (!accessToken || revealing) return;
      setRevealing(true);
      setRevealed(null);
      try {
        const tx = await purchase.buy(product.id);
        if (!tx || tx.status !== 'FULFILLED') {
          setRevealing(false);
          return;
        }
        // Backend는 즉시 user_photocards 에 write — 다시 fetch 후 baseline diff.
        const after = await api.listMyPhotocards(accessToken);
        const cards = diffSinceBaseline(baselineRef.current, after, set);
        setRevealed(cards);
        // baseline을 새 snapshot으로 갱신해 다음 draw도 정확히 diff.
        baselineRef.current = toBaselineMap(after);
      } finally {
        setRevealing(false);
      }
    },
    [accessToken, purchase, revealing, set],
  );

  if (setError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로 가기">
            <Text style={styles.back}>‹ 뒤로</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>⚠ {setError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!set) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로 가기">
            <Text style={styles.back}>‹ 뒤로</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const sortedTemplates = [...set.templates]
    .filter((t) => t.isActive)
    .sort((a, b) => b.dropWeight - a.dropWeight);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로 가기">
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.topbarTitle}>포토카드 뽑기</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Set hero */}
        <View style={styles.heroBox}>
          <Text style={styles.heroTitle}>{set.name}</Text>
          {set.idolName ? (
            <Text style={styles.heroIdol}>{set.idolName}</Text>
          ) : null}
          {set.description ? (
            <Text style={styles.heroDesc}>{set.description}</Text>
          ) : null}
          <Text style={styles.heroBadge}>총 {set.templateCount}종 카드</Text>
        </View>

        {/* Reveal — 굴러 나온 카드 */}
        {revealed && revealed.length > 0 ? (
          <View style={styles.revealBox}>
            <Text style={styles.revealTitle}>🎉 새로 획득!</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {revealed.map((c, idx) => (
                <RevealCard key={`${c.templateId}-${idx}`} card={c} delay={idx * 220} colors={colors} toUri={toUri} />
              ))}
            </ScrollView>
            <View style={styles.revealCtaRow}>
              <Pressable
                onPress={() => router.push('/(app)/collection')}
                accessibilityRole="link"
                accessibilityLabel="컬렉션 보기"
                style={({ pressed }) => [
                  styles.revealCta,
                  styles.revealCtaPrimary,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.revealCtaTextPrimary}>📇 컬렉션 보기</Text>
              </Pressable>
              <Pressable
                onPress={() => setRevealed(null)}
                accessibilityRole="button"
                accessibilityLabel="다시 뽑기"
                style={({ pressed }) => [styles.revealCta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.revealCtaText}>다시 뽑기</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* 뽑기 CTAs (가능한 product 별) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>뽑기 옵션</Text>
          {!accessToken ? (
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={({ pressed }) => [styles.loginPrompt, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.loginPromptText}>뽑으려면 로그인하세요 →</Text>
            </Pressable>
          ) : matchingProducts.length === 0 ? (
            products.loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.muted}>
                이 세트의 판매 상품이 등록되지 않았습니다.
              </Text>
            )
          ) : (
            <View style={{ gap: spacing.sm }}>
              {matchingProducts.map((p) => {
                const payload = p.deliveryPayload as { count?: number };
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => handleDraw(p)}
                    disabled={revealing || purchase.busy}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.title} 뽑기, ${p.priceKrw.toLocaleString()}원`}
                    accessibilityHint="결제 후 자동으로 카드가 공개됩니다."
                    accessibilityState={{
                      disabled: revealing || purchase.busy,
                      busy: revealing,
                    }}
                    style={({ pressed }) => [
                      styles.drawBtn,
                      (revealing || purchase.busy) && { opacity: 0.5 },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.drawBtnTitle}>{p.title}</Text>
                      <Text style={styles.drawBtnMeta}>
                        📇 {payload.count ?? 1}장 · 가중 랜덤
                      </Text>
                    </View>
                    <Text style={styles.drawBtnPrice}>
                      {revealing ? '뽑는 중...' : `₩${p.priceKrw.toLocaleString()}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <InlineErrorLine message={purchase.error} requestId={purchase.errorRequestId} />
        </View>

        {/* 확률 공개 */}
        <View style={styles.section}>
          <Pressable
            onPress={() => setShowOdds((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showOdds ? '확률 공개 닫기' : '확률 공개 열기'}
            accessibilityState={{ expanded: showOdds }}
            style={({ pressed }) => [styles.oddsToggle, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.oddsToggleText}>
              📊 확률 공개 (합계 100%) {showOdds ? '▾' : '▸'}
            </Text>
          </Pressable>
          {showOdds ? (
            <View style={styles.oddsList}>
              {sortedTemplates.map((t) => (
                <View key={t.id} style={styles.oddsRow}>
                  <Text style={styles.oddsName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[styles.oddsBadge, { color: rarityColor(t.rarity, colors) }]}>
                    {t.rarity}
                  </Text>
                  <Text style={styles.oddsPct}>{t.dropPercent.toFixed(2)}%</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function toBaselineMap(rows: UserPhotocardDto[]): ToBaselineMap {
  const m: ToBaselineMap = new Map();
  for (const r of rows) m.set(r.templateId, r.count);
  return m;
}

/**
 * Baseline → after diff. 한 templateId가 N → N+k 로 늘었으면 k장 굴러 나온 것.
 * - dup = 이미 갖고 있던 카드의 추가
 * - !dup = 처음 획득
 *
 * `set` template 메타로 imageUrl/rarity 보강 (after는 정렬되어 있어 lookup은
 * O(after.length); pack count는 작아 무시 가능).
 */
function diffSinceBaseline(
  baseline: ToBaselineMap,
  after: UserPhotocardDto[],
  set: PhotocardSetDto | null,
): RevealedCard[] {
  const out: RevealedCard[] = [];
  for (const a of after) {
    const before = baseline.get(a.templateId) ?? 0;
    const delta = a.count - before;
    if (delta <= 0) continue;
    const tpl = set?.templates.find((t) => t.id === a.templateId);
    for (let i = 0; i < delta; i++) {
      out.push({
        templateId: a.templateId,
        name: a.name,
        imageUrl: a.imageUrl ?? tpl?.imageUrl ?? null,
        rarity: a.rarity,
        dup: before > 0 || i > 0,
      });
    }
  }
  // rarity 큰 순으로 reveal 우선 (LEGENDARY 가 먼저 나오면 더 즐거움)
  const order: Record<PhotocardRarity, number> = {
    LEGENDARY: 0,
    EPIC: 1,
    RARE: 2,
    COMMON: 3,
  };
  out.sort((a, b) => order[a.rarity] - order[b.rarity]);
  return out;
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

function RevealCard({
  card,
  delay,
  colors,
  toUri,
}: {
  card: RevealedCard;
  delay: number;
  colors: ThemeColors;
  toUri: (p: string | null) => string | null;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scale, opacity, rotate, delay]);

  const rotateInterp = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['18deg', '0deg'],
  });

  const uri = toUri(card.imageUrl);
  const accent = rarityColor(card.rarity, colors);

  return (
    <Animated.View
      style={[
        revealStyles.card,
        {
          backgroundColor: colors.bg,
          borderColor: accent,
          transform: [{ scale }, { rotate: rotateInterp }],
          opacity,
          shadowColor: accent,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={revealStyles.img} resizeMode="cover" />
      ) : (
        <View style={[revealStyles.img, { backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 48, fontWeight: '900' }}>
            {card.name[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}
      <View style={[revealStyles.body, { backgroundColor: colors.surface }]}>
        <Text style={[revealStyles.name, { color: colors.text1 }]} numberOfLines={1}>
          {card.name}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[revealStyles.rarity, { color: accent }]}>{card.rarity}</Text>
          <Text style={[revealStyles.tag, { color: card.dup ? colors.text3 : colors.success }]}>
            {card.dup ? '중복' : 'NEW'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const revealStyles = StyleSheet.create({
  card: {
    width: 140,
    borderWidth: 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  img: { width: '100%', aspectRatio: 3 / 4 },
  body: { padding: spacing.sm, gap: 4 },
  name: { fontSize: fontSize.label, fontWeight: '700' },
  rarity: { fontSize: fontSize.caption, fontWeight: '800' },
  tag: { fontSize: fontSize.caption, fontWeight: '800' },
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
    topbarTitle: { color: colors.text1, fontSize: fontSize.heading, fontWeight: '800' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    error: { color: colors.danger, textAlign: 'center' },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },

    heroBox: {
      backgroundColor: colors.surface,
      borderColor: colors.borderMd,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: 6,
    },
    heroTitle: { color: colors.text1, fontSize: fontSize.display, fontWeight: '800' },
    heroIdol: { color: colors.accent, fontSize: fontSize.body, fontWeight: '700' },
    heroDesc: { color: colors.text2, fontSize: fontSize.body, lineHeight: 20 },
    heroBadge: { color: colors.text2, fontSize: fontSize.caption, marginTop: 4 },

    revealBox: {
      backgroundColor: colors.bg,
      borderColor: colors.accent,
      borderWidth: 2,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    revealTitle: { color: colors.accent, fontSize: fontSize.heading, fontWeight: '800' },
    revealCtaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    revealCta: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      borderColor: colors.borderMd,
      borderWidth: 1,
    },
    revealCtaPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    revealCtaText: { color: colors.text1, fontSize: fontSize.label, fontWeight: '700' },
    revealCtaTextPrimary: { color: '#fff', fontSize: fontSize.label, fontWeight: '700' },

    section: { gap: spacing.sm },
    sectionTitle: {
      color: colors.text2,
      fontSize: fontSize.label,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    muted: { color: colors.text2, fontSize: fontSize.label },
    loginPrompt: {
      backgroundColor: colors.accentLt,
      borderColor: colors.accent,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    loginPromptText: { color: colors.accent, fontWeight: '700', fontSize: fontSize.body },

    drawBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    drawBtnTitle: { color: '#fff', fontSize: fontSize.body, fontWeight: '800' },
    drawBtnMeta: { color: '#fff', fontSize: fontSize.caption, opacity: 0.85, marginTop: 2 },
    drawBtnPrice: { color: '#fff', fontSize: fontSize.body, fontWeight: '800' },

    oddsToggle: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
    },
    oddsToggleText: { color: colors.text2, fontSize: fontSize.caption, fontWeight: '600' },
    oddsList: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      gap: spacing.xs,
    },
    oddsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    oddsName: { flex: 1, color: colors.text1, fontSize: fontSize.caption },
    oddsBadge: { fontSize: 10, fontWeight: '800', width: 70 },
    oddsPct: {
      color: colors.text2,
      fontSize: fontSize.caption,
      fontWeight: '700',
      width: 60,
      textAlign: 'right',
    },
  });
