/**
 * 디자인 토큰 — A-idol Mobile Wireframes v2 (RPT-260426-C P0).
 *
 * 5 테마(blue/white/dark/pink/purple)는 wireframe v2의 CSS custom
 * properties에서 그대로 추출. 변경 시 wireframe HTML과 동기화 책임.
 *
 * Default = `blue` (라이트 모드). 시스템 다크모드 자동 추적은 OFF — 사용자가
 * 설정 화면(SCR-025)에서 명시적으로 dark 선택해야 다크 적용 (RPT-260426-C
 * §8 결정 #1).
 */

export type ThemeName = 'blue' | 'white' | 'dark' | 'pink' | 'purple';

export const THEME_NAMES: readonly ThemeName[] = ['blue', 'white', 'dark', 'pink', 'purple'] as const;

export const DEFAULT_THEME: ThemeName = 'blue';

export interface ThemeColors {
  /** 콘텐츠 카드/시트 기본 배경 */
  bg: string;
  /** 보조 배경 (input, card filled bg) */
  surface: string;
  /** 한 단계 더 elevated 표면 */
  elevated: string;
  /** 화면 전체 배경 (가장 바깥) */
  pageBg: string;

  /** 브랜드/액션 강조색 */
  accent: string;
  /** 강조색 약화 (선택된 chip background) */
  accentLt: string;
  /** 강조색 진하게 (gradient 시작점) */
  accentDk: string;
  /** 강조색 톤다운 (skeleton, secondary action) */
  accentSk: string;
  /** 보조 액센트 (gradient 끝점, info badge) */
  accent2: string;

  /** 본문 색 */
  text1: string;
  /** 보조 텍스트 (라벨, 캡션) */
  text2: string;
  /** 더 흐린 텍스트 (placeholder, faint) */
  text3: string;

  /** 디바이더, 카드 외곽선 */
  border: string;
  /** 더 강한 외곽선 (input border) */
  borderMd: string;

  success: string;
  danger: string;
}

export const themes: Record<ThemeName, ThemeColors> = {
  blue: {
    bg: '#FFFFFF',
    surface: '#F3F6FC',
    elevated: '#E6ECF6',
    pageBg: '#E6ECF6',
    accent: '#2563EB',
    accentLt: '#EAF1FE',
    accentDk: '#1E40AF',
    accentSk: '#60A5FA',
    accent2: '#0EA5E9',
    text1: '#0B1220',
    text2: '#556079',
    text3: '#A5AEC2',
    border: 'rgba(14,30,70,0.08)',
    borderMd: 'rgba(14,30,70,0.14)',
    success: '#10B981',
    danger: '#EF4444',
  },
  white: {
    bg: '#FFFFFF',
    surface: '#FAFAFA',
    elevated: '#F2F2F2',
    pageBg: '#EDEDED',
    accent: '#111111',
    accentLt: '#F2F2F2',
    accentDk: '#000000',
    accentSk: '#555555',
    accent2: '#666666',
    text1: '#0B0B0B',
    text2: '#555555',
    text3: '#AAAAAA',
    border: 'rgba(0,0,0,0.08)',
    borderMd: 'rgba(0,0,0,0.14)',
    success: '#10B981',
    danger: '#EF4444',
  },
  dark: {
    bg: '#0F141F',
    surface: '#171E2C',
    elevated: '#232B3D',
    pageBg: '#060913',
    accent: '#60A5FA',
    accentLt: '#1E293B',
    accentDk: '#3B82F6',
    accentSk: '#93C5FD',
    accent2: '#22D3EE',
    text1: '#F3F6FC',
    text2: '#A5AEC2',
    text3: '#5A6478',
    border: 'rgba(255,255,255,0.08)',
    borderMd: 'rgba(255,255,255,0.14)',
    success: '#10B981',
    danger: '#F87171',
  },
  pink: {
    bg: '#FFFFFF',
    surface: '#FFF3F7',
    elevated: '#FBE0EB',
    pageBg: '#FADDEA',
    accent: '#EC4899',
    accentLt: '#FCE7F3',
    accentDk: '#BE185D',
    accentSk: '#F9A8D4',
    accent2: '#F472B6',
    text1: '#1F0B17',
    text2: '#7A5568',
    text3: '#C5A8B5',
    border: 'rgba(120,20,70,0.08)',
    borderMd: 'rgba(120,20,70,0.14)',
    success: '#10B981',
    danger: '#EF4444',
  },
  purple: {
    bg: '#FFFFFF',
    surface: '#F7F3FE',
    elevated: '#EBE0FA',
    pageBg: '#DED0F5',
    accent: '#8B5CF6',
    accentLt: '#EDE9FE',
    accentDk: '#6D28D9',
    accentSk: '#C4B5FD',
    accent2: '#A78BFA',
    text1: '#180B28',
    text2: '#5E5078',
    text3: '#B4A8C8',
    border: 'rgba(60,20,120,0.08)',
    borderMd: 'rgba(60,20,120,0.14)',
    success: '#10B981',
    danger: '#EF4444',
  },
};

/** 사용자에게 보여지는 테마 라벨 (settings 화면). */
export const THEME_LABEL: Record<ThemeName, string> = {
  blue: '블루',
  white: '화이트',
  dark: '다크',
  pink: '핑크',
  purple: '퍼플',
};

/** 라운드 코너 — 와이어프레임 기준 (휴대폰 phone shell 38px 외 카드 12, chip 18). */
export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** 간격 — 와이어프레임 padding/margin 비율 기준. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 폰트 크기 — wireframe 11~17px 본문, 9~10px 라벨/캡션. */
export const fontSize = {
  caption: 10,
  label: 11,
  body: 13,
  title: 15,
  heading: 17,
  display: 22,
} as const;
