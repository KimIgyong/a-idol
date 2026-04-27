import { THEME_NAMES, themes, type ThemeColors } from '../tokens';

const REQUIRED_KEYS: ReadonlyArray<keyof ThemeColors> = [
  'bg',
  'surface',
  'elevated',
  'pageBg',
  'accent',
  'accentLt',
  'accentDk',
  'accentSk',
  'accent2',
  'text1',
  'text2',
  'text3',
  'border',
  'borderMd',
  'success',
  'danger',
];

describe('theme tokens — RPT-260426-C P0', () => {
  it('5 테마 모두 존재 (blue/white/dark/pink/purple)', () => {
    expect(THEME_NAMES).toEqual(['blue', 'white', 'dark', 'pink', 'purple']);
    for (const name of THEME_NAMES) {
      expect(themes[name]).toBeDefined();
    }
  });

  it.each(THEME_NAMES)('테마 "%s"가 16개 필수 토큰을 모두 정의', (name) => {
    const t = themes[name];
    for (const key of REQUIRED_KEYS) {
      expect(t[key]).toBeDefined();
      expect(typeof t[key]).toBe('string');
      expect(t[key].length).toBeGreaterThan(0);
    }
  });

  it('각 테마 accent 색은 모두 unique (테마 간 혼동 방지)', () => {
    const accents = THEME_NAMES.map((n) => themes[n].accent);
    expect(new Set(accents).size).toBe(THEME_NAMES.length);
  });

  it('blue 테마 accent는 wireframe v2 명시값 #2563EB과 일치', () => {
    expect(themes.blue.accent).toBe('#2563EB');
  });

  it('dark 테마는 어두운 bg(#0F141F)와 밝은 text1(#F3F6FC) 가짐', () => {
    expect(themes.dark.bg).toBe('#0F141F');
    expect(themes.dark.text1).toBe('#F3F6FC');
  });
});
