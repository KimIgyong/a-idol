import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/auth/AuthContext';
import { useChatBalance } from '../../../src/hooks/useChatBalance';
import { useChatRoom } from '../../../src/hooks/useChatRoom';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontSize, radius, spacing, type ThemeColors } from '../../../src/theme/tokens';

/**
 * SCR-007/008/009 채팅 — RPT-260426-D Phase D T-083.
 *
 *  - 토큰 마이그레이션 (deprecated `colors` → `useTheme`)
 *  - a11y: 뒤로 / 보내기 버튼 role + label + busy state
 *  - 메시지 스크롤 컨테이너에 `accessibilityLiveRegion="polite"` — 새 메시지
 *    추가 시 VoiceOver/TalkBack 자동 announce
 *  - 각 메시지 bubble에 sender role + 시간 라벨
 */
export default function ChatScreen() {
  const { idolId } = useLocalSearchParams<{ idolId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { messages, sending, loading, error, wsConnected, send } = useChatRoom(idolId, accessToken);
  const { balance, refresh: refreshBalance } = useChatBalance(accessToken);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to bottom whenever messages grow.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    try {
      await send(content);
      setDraft('');
      await refreshBalance();
    } catch {
      // Error surfaced via `error` state; also refresh balance to reflect server truth.
      await refreshBalance();
    }
  };

  const remaining = balance
    ? balance.remainingFreeMessages > 0
      ? `무료 ${balance.remainingFreeMessages}회 남음`
      : `쿠폰 ${balance.couponBalance}매`
    : '…';

  const sendDisabled = sending || !draft.trim();

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
        <View style={styles.topRight}>
          <View
            style={[styles.dot, { backgroundColor: wsConnected ? colors.success : colors.text3 }]}
            accessibilityLabel={wsConnected ? '실시간 연결됨' : '연결 끊김'}
          />
          <Text style={styles.status}>{wsConnected ? 'live' : 'rest'}</Text>
          <Text
            style={styles.balanceBadge}
            accessibilityLabel={`잔액 ${remaining}`}
          >
            {remaining}
          </Text>
        </View>
      </View>

      {error ? (
        <Text style={styles.error} numberOfLines={2} accessibilityRole="alert">
          ⚠ {error}
        </Text>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            // 새 메시지 추가 시 스크린리더 polite announce. user 의 키보드 입력은
            // 차단하지 않음 (assertive 가 아니라 polite).
            accessibilityLiveRegion="polite"
          >
            {messages.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>첫 메시지를 보내보세요 💬</Text>
              </View>
            ) : (
              messages.map((m) => {
                const time = new Date(m.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const senderLabel = m.senderType === 'user' ? '내 메시지' : '아이돌 메시지';
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.bubble,
                      m.senderType === 'user' ? styles.bubbleUser : styles.bubbleIdol,
                    ]}
                    // VoiceOver는 이 한 단위로 묶어 안내 (sender + content + time).
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`${senderLabel}, ${m.content}, ${time}`}
                  >
                    <Text
                      style={
                        m.senderType === 'user' ? styles.bubbleTextUser : styles.bubbleTextIdol
                      }
                    >
                      {m.content}
                    </Text>
                    <Text style={styles.bubbleTime}>{time}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="메시지 입력…"
            placeholderTextColor={colors.text3}
            multiline
            maxLength={2000}
            editable={!sending}
            accessibilityLabel="채팅 메시지 입력"
          />
          <Pressable
            onPress={onSend}
            disabled={sendDisabled}
            accessibilityRole="button"
            accessibilityLabel="메시지 보내기"
            accessibilityState={{ disabled: sendDisabled, busy: sending }}
            style={({ pressed }) => [
              styles.sendBtn,
              sendDisabled && styles.sendBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.sendText}>{sending ? '…' : '보내기'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.pageBg },
    flex: { flex: 1 },
    topbar: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    back: { color: colors.text2, fontSize: fontSize.title },
    topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4 },
    status: { color: colors.text2, fontSize: fontSize.label },
    balanceBadge: {
      color: colors.text2,
      fontSize: fontSize.label,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 2,
    },

    error: {
      color: colors.danger,
      fontSize: fontSize.label,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xs,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    messages: { padding: spacing.xl, gap: spacing.sm },
    empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
    emptyText: { color: colors.text2 },

    bubble: {
      maxWidth: '82%',
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: colors.accent,
      borderBottomRightRadius: radius.sm,
    },
    bubbleIdol: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderBottomLeftRadius: radius.sm,
    },
    bubbleTextUser: { color: '#fff', fontSize: fontSize.body, lineHeight: 20 },
    bubbleTextIdol: { color: colors.text1, fontSize: fontSize.body, lineHeight: 20 },
    bubbleTime: { color: colors.text2, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
    },
    input: {
      flex: 1,
      minHeight: 38,
      maxHeight: 120,
      backgroundColor: colors.elevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text1,
      fontSize: fontSize.body,
    },
    sendBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendText: { color: '#fff', fontWeight: '700' },
  });
