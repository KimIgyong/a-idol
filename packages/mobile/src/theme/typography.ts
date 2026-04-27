import { Platform, type TextStyle } from 'react-native';

/**
 * 와이어프레임 v2 표준 폰트 스택. Apple SD Gothic Neo는 iOS 시스템 폰트,
 * Noto Sans KR는 Android에서 한국어 가독성 OK. RN의 `fontFamily`는 단일
 * 문자열만 받으므로 platform별로 분기.
 *
 * Custom 폰트(예: Pretendard) 도입은 `expo-font`로 별도 자산 ship 필요
 * → Phase D 디자인 자산 합류 시점에 결정.
 */
export const fontFamily = Platform.select({
  ios: 'Apple SD Gothic Neo',
  android: 'sans-serif',
  default: 'System',
});

/**
 * 자주 쓰는 텍스트 스타일 — `useTheme().colors.text*`와 조합해 사용.
 * 색상은 별도(`color: colors.text1`)로 적용 — 폰트만 통일.
 */
export const textStyles = {
  display: { fontFamily, fontSize: 22, fontWeight: '800' as TextStyle['fontWeight'], letterSpacing: -0.5 },
  heading: { fontFamily, fontSize: 17, fontWeight: '700' as TextStyle['fontWeight'] },
  title: { fontFamily, fontSize: 15, fontWeight: '700' as TextStyle['fontWeight'] },
  body: { fontFamily, fontSize: 13, fontWeight: '500' as TextStyle['fontWeight'] },
  label: { fontFamily, fontSize: 11, fontWeight: '600' as TextStyle['fontWeight'] },
  caption: { fontFamily, fontSize: 10, fontWeight: '400' as TextStyle['fontWeight'] },
} as const;
