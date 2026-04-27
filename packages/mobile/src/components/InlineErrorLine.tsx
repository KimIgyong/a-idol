import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';

/**
 * Single-line error + optional correlation id trailer, matching ADR-017.
 * The hook already applies the 5xx/network filter via `takeErrorRequestId`,
 * so this component just renders whatever state is passed.
 *
 * `selectable` on the id line lets the user long-press → copy on both
 * RN iOS and Android.
 *
 * RPT-260426-C P0 — 5 테마 토큰 기반으로 마이그레이션. danger / text3 색은
 * 활성 테마에서 자동 적용.
 */
export function InlineErrorLine({
  message,
  requestId,
}: {
  message: string | null;
  requestId: string | null;
}) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={{ paddingVertical: spacing.xs }}>
      <Text style={{ color: colors.danger, fontSize: 12 }}>⚠ {message}</Text>
      {requestId ? (
        <Text
          style={{ color: colors.text3, fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}
          selectable
        >
          요청 ID: {shortTrace(requestId)}
        </Text>
      ) : null}
    </View>
  );
}

function shortTrace(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}
