/**
 * 5 테마(blue/white/dark/pink/purple)의 text-on-bg 조합 WCAG 2.1 contrast
 * audit (T-083 후속, RPT-260426-D Phase D).
 *
 * Body text(<24px regular, <18.66px bold) AA = 4.5:1
 * Large text(>=24px regular, >=18.66px bold) AA = 3:1
 *
 * 우리 wireframe 폰트 (caption=10, label=11, body=13, title=15, heading=17,
 * display=22)는 모두 24px 미만 → **모두 4.5:1 기준 적용**.
 *
 * Run:
 *   pnpm --filter @a-idol/mobile exec ts-node scripts/contrast-audit.ts
 */

import { themes, type ThemeColors, type ThemeName } from '../src/theme/tokens';

type RGB = { r: number; g: number; b: number; a: number };

function parseColor(input: string): RGB {
  // #RRGGBB / #RRGGBBAA / rgba(R,G,B,A)
  if (input.startsWith('#')) {
    const hex = input.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const m = /^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/i.exec(input);
  if (m) {
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] !== undefined ? Number(m[4]) : 1,
    };
  }
  throw new Error(`Unparseable color: ${input}`);
}

/** alpha 적용 — overlay over `bg` (이미 opaque 가정). */
function blend(fg: RGB, bg: RGB): RGB {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

/** sRGB → relative luminance (WCAG 2.1). */
function luminance(c: RGB): number {
  const lin = (v: number) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function contrastRatio(fg: RGB, bg: RGB): number {
  const effFg = fg.a < 1 ? blend(fg, bg) : fg;
  const l1 = luminance(effFg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_KEYS: Array<keyof ThemeColors> = ['text1', 'text2', 'text3'];
const BG_KEYS: Array<keyof ThemeColors> = ['bg', 'surface', 'elevated', 'pageBg', 'accentLt'];
/** Accent / accent2 / success / danger / accentSk 버튼은 거의 모두 흰 글자 사용. */
const BUTTON_BG_KEYS: Array<keyof ThemeColors> = ['accent', 'accent2', 'accentDk', 'accentSk', 'success', 'danger'];
const BUTTON_TEXT = '#FFFFFF';
const AA_BODY = 4.5;

type RowResult = {
  theme: ThemeName;
  text: keyof ThemeColors;
  bg: keyof ThemeColors;
  textHex: string;
  bgHex: string;
  ratio: number;
  pass: boolean;
};

function audit(): RowResult[] {
  const out: RowResult[] = [];
  for (const theme of Object.keys(themes) as ThemeName[]) {
    const palette = themes[theme];
    // 텍스트 토큰 × 배경 토큰
    for (const t of TEXT_KEYS) {
      for (const b of BG_KEYS) {
        const fg = parseColor(palette[t]);
        const bg = parseColor(palette[b]);
        const ratio = contrastRatio(fg, bg);
        out.push({
          theme,
          text: t,
          bg: b,
          textHex: palette[t],
          bgHex: palette[b],
          ratio: Number(ratio.toFixed(2)),
          pass: ratio >= AA_BODY,
        });
      }
    }
    // 흰 텍스트(button) × 액센트류 배경
    const fg = parseColor(BUTTON_TEXT);
    for (const b of BUTTON_BG_KEYS) {
      const bg = parseColor(palette[b]);
      const ratio = contrastRatio(fg, bg);
      out.push({
        theme,
        text: '#FFF' as keyof ThemeColors,
        bg: b,
        textHex: BUTTON_TEXT,
        bgHex: palette[b],
        ratio: Number(ratio.toFixed(2)),
        pass: ratio >= AA_BODY,
      });
    }
  }
  return out;
}

function main() {
  const rows = audit();
  console.log('# 5테마 × text/bg 조합 WCAG 2.1 AA 컨트라스트 audit');
  console.log(`# 기준: body text AA = ${AA_BODY}:1 (모든 wireframe 폰트 < 24px)`);
  console.log('');
  for (const theme of Object.keys(themes) as ThemeName[]) {
    const subset = rows.filter((r) => r.theme === theme);
    const fails = subset.filter((r) => !r.pass);
    const status = fails.length === 0 ? '✅ PASS' : `❌ ${fails.length} FAIL`;
    console.log(`## ${theme} — ${status}`);
    console.log('| text | bg | ratio | verdict |');
    console.log('|---|---|---|---|');
    for (const r of subset) {
      const v = r.pass ? '✅ AA' : `❌ AA (need ${AA_BODY}:1)`;
      console.log(`| ${r.text} (${r.textHex}) | ${r.bg} (${r.bgHex}) | ${r.ratio}:1 | ${v} |`);
    }
    console.log('');
  }
  const totalFails = rows.filter((r) => !r.pass).length;
  console.log(`## 종합: ${rows.length - totalFails}/${rows.length} pass · ${totalFails} fail`);

  // 현재 baseline: text3 의 25 fail은 documented design intent — a11y-mobile-
  // baseline-ko.md §5.2 참조. 추가로 흰-텍스트 버튼 × accent 류 배경에서
  // light-tone(blue dark theme accent, pink accent2 등)이 4.5:1 미달 가능 —
  // 별도 baseline에 흡수. 회귀 감지는 baseline 초과 시.
  // `--strict` 플래그는 모든 fail을 exit 1로 처리 (전 WCAG AA 통과 후 CI gate).
  const BASELINE_FAILS = 50;
  const strict = process.argv.includes('--strict');
  if (strict && totalFails > 0) {
    console.error(`\n--strict: 1 이상의 contrast fail. CI gate 실패.`);
    process.exit(1);
  }
  if (totalFails > BASELINE_FAILS) {
    console.error(
      `\n회귀 감지: ${totalFails} fail > baseline ${BASELINE_FAILS}. ` +
        `text3 외 새 토큰 contrast 누락 또는 텍스트 swap이 필요합니다.`,
    );
    process.exit(1);
  }
  // baseline 또는 그 이하 → exit 0 (informational).
}

main();
