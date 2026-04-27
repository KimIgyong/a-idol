import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../src/theme/tokens';

/**
 * SCR-020 마이페이지 hub — RPT-260426-C P4.
 *
 * 5개 sub-route 진입점 (포토카드/구독/투표/찜/설정) + 프로필 카드 + 로그아웃.
 * 토큰 기반 5테마 지원.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refreshMe } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>마이페이지</Text>
        <Pressable
          onPress={refreshMe}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="프로필 새로 고침"
        >
          <Text style={styles.refresh}>↻</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nickname?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nickname}>{user?.nickname ?? '—'}</Text>
            <Text style={styles.email}>{user?.email ?? '—'}</Text>
            <Text style={styles.joined}>
              {user?.createdAt
                ? `${new Date(user.createdAt).toLocaleDateString()} 가입`
                : '—'}
            </Text>
          </View>
        </View>

        {/* 5 sub-routes */}
        <NavRow
          emoji="📇"
          title="구매 포토카드"
          sub="내 콜렉션 (set/rarity 별)"
          onPress={() => router.push('/(app)/me/photocards')}
          colors={colors}
        />
        <NavRow
          emoji="💎"
          title="구독 정보"
          sub="가입 중인 팬클럽"
          onPress={() => router.push('/(app)/me/memberships')}
          colors={colors}
        />
        <NavRow
          emoji="🗳"
          title="투표 이력"
          sub="라운드별 HEART/TICKET 기록"
          onPress={() => router.push('/(app)/me/votes')}
          colors={colors}
        />
        <NavRow
          emoji="❤️"
          title="찜한 아티스트"
          sub="하트 + 팔로우"
          onPress={() => router.push('/(app)/me/follows')}
          colors={colors}
        />
        <NavRow
          emoji="⚙️"
          title="설정"
          sub="테마 · 알림 · 마케팅 동의"
          onPress={() => router.push('/(app)/me/settings')}
          colors={colors}
        />

        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavRow({
  emoji,
  title,
  sub,
  onPress,
  colors,
}: {
  emoji: string;
  title: string;
  sub: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={title}
      accessibilityHint={sub}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text1, fontSize: fontSize.body, fontWeight: '700' }}>
          {title}
        </Text>
        <Text style={{ color: colors.text2, fontSize: fontSize.caption, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
      <Text style={{ color: colors.text3, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.pageBg },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { color: colors.text1, fontSize: fontSize.display, fontWeight: '800' },
    refresh: { color: colors.text2, fontSize: 20 },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      backgroundColor: colors.surface,
      borderColor: colors.borderMd,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
    nickname: { color: colors.text1, fontSize: fontSize.heading, fontWeight: '700' },
    email: { color: colors.text2, fontSize: fontSize.caption, marginTop: 2 },
    joined: { color: colors.text3, fontSize: fontSize.caption, marginTop: 2 },

    logout: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    logoutText: { color: colors.danger, fontWeight: '700' },
  });
