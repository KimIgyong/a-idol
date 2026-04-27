import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CheerDto, IdolImageDto } from '@a-idol/shared';
import { api } from '../../../src/api/client';
import { useAuth } from '../../../src/auth/AuthContext';
import { InlineErrorLine } from '../../../src/components/InlineErrorLine';
import { useCheers } from '../../../src/hooks/useCheers';
import { useIdolDetail } from '../../../src/hooks/useIdolDetail';
import { useIdolFanClub, useIdolFandom } from '../../../src/hooks/useFandom';
import { useIdolsList } from '../../../src/hooks/useIdolsList';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-006 아이돌 상세 — RPT-260426-C P2.
 *
 *  - 토큰 기반 5테마 지원
 *  - 좌/우 chevron으로 인접 아이돌 네비게이션 (인기순 list 기준)
 *  - 응원댓글 섹션 (인증 필요 작성, 공개 read)
 */
export default function IdolDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { idol, loading, error } = useIdolDetail(id, accessToken);

  const heroPrefix = useMemo(() => api.baseUrl.replace(/\/1$/, ''), []);
  const toUri = (path: string | null) =>
    !path ? null : path.startsWith('http') ? path : `${heroPrefix}${path}`;

  const fandom = useIdolFandom({
    idolId: id,
    token: accessToken,
    initialHeartCount: idol?.heartCount ?? 0,
    initialFollowCount: idol?.followCount ?? 0,
  });
  const fanClub = useIdolFanClub(id, accessToken);
  const cheers = useCheers(id, accessToken);

  // 인접 idol — 인기순 list에서 prev/next 탐색. ETag 캐시되어 비용 작음.
  const list = useIdolsList(accessToken);
  const idx = list.items.findIndex((i) => i.id === id);
  const prevId = idx > 0 ? list.items[idx - 1].id : null;
  const nextId = idx >= 0 && idx < list.items.length - 1 ? list.items[idx + 1].id : null;
  const goPrev = () => prevId && router.replace(`/(app)/idol/${prevId}`);
  const goNext = () => nextId && router.replace(`/(app)/idol/${nextId}`);

  const [cheerDraft, setCheerDraft] = useState('');

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
        <View style={styles.navRow}>
          <Pressable
            onPress={goPrev}
            disabled={!prevId}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="이전 아이돌"
            accessibilityState={{ disabled: !prevId }}
            style={({ pressed }) => [
              styles.navBtn,
              !prevId && { opacity: 0.3 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.navBtnText}>◀</Text>
          </Pressable>
          {idx >= 0 && list.items.length > 0 ? (
            <Text
              accessibilityLabel={`${idx + 1}번째, 전체 ${list.items.length}명 중`}
              style={styles.navCount}
            >
              {idx + 1} / {list.items.length}
            </Text>
          ) : null}
          <Pressable
            onPress={goNext}
            disabled={!nextId}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="다음 아이돌"
            accessibilityState={{ disabled: !nextId }}
            style={({ pressed }) => [
              styles.navBtn,
              !nextId && { opacity: 0.3 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.navBtnText}>▶</Text>
          </Pressable>
        </View>
      </View>

      {loading && !idol ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error || !idol ? (
        <View style={styles.center}>
          <Text style={styles.error}>⚠ {error ?? '아이돌을 불러올 수 없습니다.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Hero */}
          {toUri(idol.heroImageUrl) ? (
            <Image source={{ uri: toUri(idol.heroImageUrl)! }} style={styles.hero} resizeMode="cover" />
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Text style={styles.heroChar}>
                {(idol.stageName ?? idol.name)[0]?.toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.title}>{idol.stageName ?? idol.name}</Text>
          <View style={styles.metaRow}>
            {idol.stageName && idol.stageName !== idol.name ? (
              <Text style={styles.metaText}>{idol.name}</Text>
            ) : null}
            {idol.mbti ? <Pill text={idol.mbti} colors={colors} /> : null}
            {idol.birthdate ? <Pill text={idol.birthdate} colors={colors} /> : null}
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <Stat label="하트" value={`❤ ${fandom.heartCount.toLocaleString()}`} colors={colors} />
            <Stat label="팔로워" value={`👥 ${fandom.followCount.toLocaleString()}`} colors={colors} />
          </View>

          {/* Fandom actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={fandom.toggleHeart}
              disabled={fandom.heartBusy}
              accessibilityRole="button"
              accessibilityLabel={fandom.hearted ? '하트 취소' : '하트 보내기'}
              accessibilityState={{
                disabled: fandom.heartBusy,
                busy: fandom.heartBusy,
                selected: !!fandom.hearted,
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                fandom.hearted ? styles.actionBtnFilled : styles.actionBtnOutline,
                pressed && { opacity: 0.85 },
                fandom.heartBusy && { opacity: 0.6 },
              ]}
            >
              <Text style={fandom.hearted ? styles.actionTextFilled : styles.actionTextOutline}>
                {fandom.hearted ? '❤ 하트 취소' : '❤ 하트 보내기'}
              </Text>
            </Pressable>
            <Pressable
              onPress={fandom.toggleFollow}
              disabled={fandom.followBusy}
              accessibilityRole="button"
              accessibilityLabel={fandom.following ? '팔로우 취소' : '팔로우'}
              accessibilityState={{
                disabled: fandom.followBusy,
                busy: fandom.followBusy,
                selected: !!fandom.following,
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                fandom.following ? styles.actionBtnFilled : styles.actionBtnOutline,
                pressed && { opacity: 0.85 },
                fandom.followBusy && { opacity: 0.6 },
              ]}
            >
              <Text style={fandom.following ? styles.actionTextFilled : styles.actionTextOutline}>
                {fandom.following ? '팔로잉' : '팔로우'}
              </Text>
            </Pressable>
          </View>
          <InlineErrorLine message={fandom.error} requestId={fandom.errorRequestId} />

          {/* Bio */}
          {idol.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>소개</Text>
              <Text style={styles.bio}>{idol.bio}</Text>
            </View>
          ) : null}

          {/* Image gallery */}
          {idol.images.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>갤러리</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={idol.images}
                keyExtractor={(img) => img.id}
                contentContainerStyle={styles.gallery}
                renderItem={({ item }) => (
                  <GalleryImage img={item} toUri={toUri} colors={colors} />
                )}
              />
            </View>
          ) : null}

          {/* Fan Club */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>팬클럽</Text>
            {fanClub.loading && !fanClub.status ? (
              <ActivityIndicator color={colors.accent} />
            ) : fanClub.status ? (
              <View style={styles.fanClub}>
                <View style={styles.fanClubHead}>
                  <Text style={styles.fanClubTier}>
                    {fanClub.status.fanClub.tier} ·{' '}
                    {fanClub.status.fanClub.memberCount.toLocaleString()}명
                  </Text>
                  <Text style={styles.fanClubPrice}>
                    {fanClub.status.fanClub.price === 0
                      ? '무료'
                      : `₩${fanClub.status.fanClub.price.toLocaleString()}`}
                  </Text>
                </View>
                <View style={styles.fanClubActions}>
                  {fanClub.status.isMember ? (
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/(app)/chat/[idolId]', params: { idolId: idol.id } })
                      }
                      style={({ pressed }) => [
                        styles.fanClubBtn,
                        styles.fanClubBtnJoin,
                        { flex: 1 },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.fanClubBtnText}>💬 채팅하기</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={fanClub.status.isMember ? fanClub.leave : fanClub.join}
                    disabled={fanClub.busy}
                    style={({ pressed }) => [
                      styles.fanClubBtn,
                      fanClub.status!.isMember ? styles.fanClubBtnLeave : styles.fanClubBtnJoin,
                      { flex: 1 },
                      pressed && { opacity: 0.85 },
                      fanClub.busy && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fanClubBtnText,
                        fanClub.status.isMember && styles.fanClubBtnTextLeave,
                      ]}
                    >
                      {fanClub.status.isMember ? '탈퇴' : '가입하기'}
                    </Text>
                  </Pressable>
                </View>
                {fanClub.status.joinedAt ? (
                  <Text style={styles.fanClubJoined}>
                    가입일 · {new Date(fanClub.status.joinedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            ) : fanClub.error ? (
              <InlineErrorLine message={fanClub.error} requestId={fanClub.errorRequestId} />
            ) : (
              <Text style={styles.muted}>팬클럽 정보가 없습니다.</Text>
            )}
          </View>

          {/* 응원 댓글 (SCR-006) */}
          <View style={styles.section}>
            <View style={styles.cheerHeader}>
              <Text style={styles.sectionTitle}>응원 댓글</Text>
              <Text style={styles.cheerCount}>{cheers.total.toLocaleString()}</Text>
            </View>

            {accessToken ? (
              <View style={styles.cheerInputBox}>
                <TextInput
                  value={cheerDraft}
                  onChangeText={setCheerDraft}
                  placeholder="응원의 한마디 (200자 이내)"
                  placeholderTextColor={colors.text3}
                  maxLength={200}
                  multiline
                  style={styles.cheerInput}
                  editable={!cheers.posting}
                />
                <View style={styles.cheerInputFoot}>
                  <Text style={styles.cheerLen}>
                    {cheerDraft.length} / 200
                  </Text>
                  <Pressable
                    onPress={async () => {
                      const ok = await cheers.post(cheerDraft);
                      if (ok) setCheerDraft('');
                    }}
                    disabled={cheers.posting || cheerDraft.trim().length === 0}
                    accessibilityRole="button"
                    accessibilityLabel="응원 댓글 작성"
                    accessibilityState={{
                      disabled: cheers.posting || cheerDraft.trim().length === 0,
                      busy: cheers.posting,
                    }}
                    style={({ pressed }) => [
                      styles.cheerPostBtn,
                      (cheers.posting || cheerDraft.trim().length === 0) && { opacity: 0.5 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={styles.cheerPostBtnText}>
                      {cheers.posting ? '...' : '작성'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => router.push('/(auth)/login')}
                style={({ pressed }) => [
                  styles.cheerLoginPrompt,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.cheerLoginPromptText}>응원하려면 로그인하세요 →</Text>
              </Pressable>
            )}
            <InlineErrorLine message={cheers.error} requestId={cheers.errorRequestId} />

            {cheers.items.length === 0 && !cheers.loading ? (
              <Text style={styles.muted}>아직 응원이 없습니다. 첫 응원을 남겨보세요!</Text>
            ) : (
              cheers.items.map((c) => <CheerRow key={c.id} cheer={c} colors={colors} />)
            )}

            {cheers.hasMore ? (
              <Pressable
                onPress={cheers.loadMore}
                disabled={cheers.loading}
                style={({ pressed }) => [
                  styles.cheerMoreBtn,
                  pressed && { opacity: 0.85 },
                  cheers.loading && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.cheerMoreBtnText}>
                  {cheers.loading ? '불러오는 중...' : '더보기'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Pill({ text, colors }: { text: string; colors: ThemeColors }) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
      }}
    >
      <Text style={{ color: colors.text2, fontSize: fontSize.label, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
      }}
    >
      <Text style={{ color: colors.text2, fontSize: fontSize.label }}>{label}</Text>
      <Text style={{ color: colors.text1, fontSize: 18, fontWeight: '800', marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function GalleryImage({
  img,
  toUri,
  colors,
}: {
  img: IdolImageDto;
  toUri: (p: string | null) => string | null;
  colors: ThemeColors;
}) {
  const uri = toUri(img.imageUrl);
  if (!uri) return null;
  return (
    <View style={{ width: 140 }}>
      <Image
        source={{ uri }}
        style={{
          width: 140,
          height: 180,
          borderRadius: radius.md,
          backgroundColor: colors.elevated,
        }}
        resizeMode="cover"
      />
      <Text
        style={{
          color: colors.text2,
          fontSize: fontSize.caption,
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        {img.imageType}
      </Text>
    </View>
  );
}

function CheerRow({ cheer, colors }: { cheer: CheerDto; colors: ThemeColors }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text1, fontSize: fontSize.body, fontWeight: '700' }}>
          {cheer.author.nickname}
        </Text>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption }}>
          {formatRelative(cheer.createdAt)}
        </Text>
      </View>
      <Text style={{ color: colors.text1, fontSize: fontSize.body, lineHeight: 20 }}>
        {cheer.message}
      </Text>
    </View>
  );
}

/** 단순 상대시간 포맷 — "방금 전" / "5분 전" / "3시간 전" / "2일 전" / yyyy-MM-dd. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`;
  return new Date(iso).toLocaleDateString();
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

    navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderColor: colors.borderMd,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnText: { color: colors.text1, fontSize: fontSize.label, fontWeight: '700' },
    navCount: { color: colors.text2, fontSize: fontSize.label, minWidth: 48, textAlign: 'center' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    error: { color: colors.danger, textAlign: 'center' },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

    hero: { height: 240, borderRadius: radius.xl, backgroundColor: colors.elevated },
    heroFallback: {
      backgroundColor: colors.accent,
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      padding: spacing.xl,
    },
    heroChar: { color: '#fff', fontSize: 88, fontWeight: '900' },
    title: { color: colors.text1, fontSize: fontSize.display + 4, fontWeight: '800' },
    metaRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    metaText: { color: colors.text2, fontSize: fontSize.body },

    stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },

    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    actionBtn: {
      flex: 1,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
    },
    actionBtnFilled: { backgroundColor: colors.accent },
    actionBtnOutline: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    actionTextFilled: { color: '#fff', fontWeight: '700' },
    actionTextOutline: { color: colors.text1, fontWeight: '700' },

    section: { marginTop: spacing.lg, gap: spacing.sm },
    sectionTitle: {
      color: colors.text2,
      fontSize: fontSize.label,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    bio: { color: colors.text1, fontSize: fontSize.body, lineHeight: 20 },
    muted: { color: colors.text2, fontSize: fontSize.label },

    gallery: { gap: spacing.sm, paddingRight: spacing.xl },

    fanClub: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    fanClubHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fanClubTier: { color: colors.text1, fontSize: fontSize.body, fontWeight: '700' },
    fanClubPrice: { color: colors.text2, fontSize: fontSize.label },
    fanClubActions: { flexDirection: 'row', gap: spacing.sm },
    fanClubBtn: {
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 4,
      alignItems: 'center',
    },
    fanClubBtnJoin: { backgroundColor: colors.accent },
    fanClubBtnLeave: {
      backgroundColor: colors.elevated,
      borderColor: colors.border,
      borderWidth: 1,
    },
    fanClubBtnText: { color: '#fff', fontWeight: '700' },
    fanClubBtnTextLeave: { color: colors.text1 },
    fanClubJoined: { color: colors.text2, fontSize: fontSize.caption, textAlign: 'center' },

    cheerHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    cheerCount: { color: colors.accent, fontSize: fontSize.label, fontWeight: '800' },

    cheerInputBox: {
      backgroundColor: colors.surface,
      borderColor: colors.borderMd,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cheerInput: {
      color: colors.text1,
      fontSize: fontSize.body,
      minHeight: 48,
      maxHeight: 120,
      padding: 0,
    },
    cheerInputFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cheerLen: { color: colors.text2, fontSize: fontSize.caption },
    cheerPostBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    cheerPostBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.label },

    cheerLoginPrompt: {
      backgroundColor: colors.accentLt,
      borderColor: colors.accent,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    cheerLoginPromptText: { color: colors.accent, fontWeight: '700', fontSize: fontSize.body },

    cheerMoreBtn: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    cheerMoreBtnText: { color: colors.text2, fontWeight: '700', fontSize: fontSize.label },
  });
