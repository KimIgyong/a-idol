/**
 * SVG placeholder generator for idol images. Zero runtime dependencies.
 *
 * For each image in an IdolProfileJson, produces an SVG that encodes:
 *   - A 2-stop gradient derived from hair_color + skin_tone + concept tint
 *   - A silhouette avatar suggesting gender presentation and hair style
 *   - The stage name, image type, and concept name as labels
 *   - The target aspect ratio matching `prompt-builder` output
 *
 * This keeps the layout and size realistic so downstream UI (mobile hero,
 * portrait grids, character sheet previews) renders correctly — the bytes
 * are just swapped in later when real assets arrive.
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import type { IdolProfileJson } from './idol-profile.types';
import { buildPromptsForProfile, type BuiltPrompt } from './prompt-builder';

interface Palette {
  bg1: string;
  bg2: string;
  accent: string;
  ink: string;
  hair: string;
  skin: string;
}

const NAMED_HAIR: Record<string, string> = {
  'dark espresso': '#2b1d16',
  'espresso': '#2b1d16',
  'black': '#111111',
  'dark brown': '#3b2219',
  'brown': '#5a3822',
  'caramel': '#a2682a',
  'honey blonde': '#c98b44',
  'blonde': '#e8c879',
  'platinum': '#eae1cc',
  'silver': '#bbbdc2',
  'rose gold': '#d49797',
  'pink': '#e96fa5',
  'red': '#a52626',
  'purple': '#6c4675',
  'blue': '#1d4ed8',
};

const NAMED_SKIN: Record<string, string> = {
  'fair': '#f5d4ae',
  'light': '#f0c9a8',
  'medium': '#d9a679',
  'tan': '#bc8657',
  'olive': '#c69d6d',
  'deep': '#8a5532',
  'dark': '#5d3a20',
};

function resolveColor(map: Record<string, string>, key: string, fallback: string): string {
  if (!key) return fallback;
  const lower = key.toLowerCase();
  if (map[lower]) return map[lower];
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v;
  }
  return fallback;
}

function mix(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function derivePalette(p: IdolProfileJson): Palette {
  const hair = resolveColor(NAMED_HAIR, p.faceVector.default_styling.hair_color, '#2b1d16');
  const skin = resolveColor(NAMED_SKIN, p.faceVector.identity.skin_tone, '#f5d4ae');
  // Concept-driven tint: "raw brilliance" → warm amber; "ethereal" → cool
  const mood = (p.conceptSeed.visual_mood ?? '').toLowerCase();
  const tintAccent =
    mood.includes('warm') || mood.includes('golden') ? '#d49547' :
    mood.includes('cool') || mood.includes('ice') || mood.includes('cyber') ? '#4a6cdf' :
    mood.includes('dark') || mood.includes('moody') ? '#6c4675' :
    mood.includes('dishevelled') || mood.includes('artist') ? '#b07842' :
    '#FF7A20';

  return {
    bg1: mix(hair, '#ffffff', 0.72),
    bg2: mix(hair, tintAccent, 0.35),
    accent: tintAccent,
    ink: '#18181e',
    hair,
    skin,
  };
}

/** aspect-ratio string like "9:16" → [width, height] in px at ~1024 short side. */
function dimensionsFor(aspect: string): { w: number; h: number } {
  const [a, b] = aspect.split(':').map(Number);
  // Portrait-ish: aspect short:long — keep long side 1024 (fast to generate & ship).
  const LONG = 1024;
  if (a <= b) return { w: Math.round((a / b) * LONG), h: LONG };
  return { w: LONG, h: Math.round((b / a) * LONG) };
}

interface SvgOpts {
  palette: Palette;
  stageName: string;
  conceptName: string;
  imageType: string;
  aspect: string;
  gender: 'male' | 'female' | string;
}

function silhouette(cx: number, cy: number, scale: number, gender: string): string {
  // Simple head + shoulders silhouette. Scale controls overall size.
  const headR = 80 * scale;
  const neckY = cy - headR * 0.1;
  const shoulderY = cy + headR * 1.6;
  const shoulderW = headR * 3;
  const headY = cy - headR * 0.9;
  // Feminine silhouettes get slightly narrower shoulders; masculine wider.
  const sw = gender === 'feminine' || gender === 'female' ? shoulderW * 0.85 : shoulderW;
  return `
    <ellipse cx="${cx}" cy="${headY}" rx="${headR}" ry="${headR * 1.05}" />
    <path d="M ${cx - sw / 2} ${shoulderY + 120 * scale}
             Q ${cx - sw / 2} ${neckY + headR * 0.4} ${cx - headR * 0.45} ${neckY + headR * 0.45}
             L ${cx + headR * 0.45} ${neckY + headR * 0.45}
             Q ${cx + sw / 2} ${neckY + headR * 0.4} ${cx + sw / 2} ${shoulderY + 120 * scale}
             Z" />
  `;
}

function renderSvg(opts: SvgOpts): string {
  const { w, h } = dimensionsFor(opts.aspect);
  const { palette, stageName, conceptName, imageType } = opts;
  const cx = w / 2;
  const cy = h * 0.52;
  const scale = Math.min(w, h) / 420;
  const isCharSheet = imageType.startsWith('character_sheet');
  const labelType = imageType.replace('character_sheet/', '').replace(/_/g, ' ').toUpperCase();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg1}"/>
      <stop offset="100%" stop-color="${palette.bg2}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.22)"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(scale * 4)}"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${isCharSheet ? renderGridLines(w, h, palette) : ''}
  <g fill="${palette.skin}" opacity="0.9" filter="url(#blur)">
    ${silhouette(cx, cy, scale, opts.gender)}
  </g>
  <g fill="${palette.hair}" opacity="0.95">
    <ellipse cx="${cx}" cy="${cy - 80 * scale}" rx="${92 * scale}" ry="${60 * scale}"/>
  </g>
  <rect width="100%" height="100%" fill="url(#vignette)"/>
  <g font-family="'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif">
    <text x="${w / 2}" y="${h - 56 * scale}" text-anchor="middle"
          font-size="${Math.round(44 * scale)}" font-weight="900"
          fill="#ffffff" letter-spacing="-1">
      ${escapeXml(stageName)}
    </text>
    <text x="${w / 2}" y="${h - 28 * scale}" text-anchor="middle"
          font-size="${Math.round(14 * scale)}" font-weight="700"
          fill="${palette.accent}" letter-spacing="3">
      ${escapeXml(labelType)}
    </text>
    <text x="${w / 2}" y="${56 * scale}" text-anchor="middle"
          font-size="${Math.round(12 * scale)}" font-weight="600"
          fill="rgba(255,255,255,0.82)" letter-spacing="2">
      ${escapeXml(conceptName.toUpperCase())}
    </text>
  </g>
</svg>`;
}

function renderGridLines(w: number, h: number, palette: Palette): string {
  // Reference-sheet look: 3x2 grid lines
  const gx = [w / 3, (2 * w) / 3];
  const gy = [h / 2];
  const stroke = palette.accent + '33';
  return `
    ${gx.map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${stroke}" stroke-width="1"/>`).join('')}
    ${gy.map((y) => `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${stroke}" stroke-width="1"/>`).join('')}
  `;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
}

export interface GeneratedAsset {
  /** Absolute filesystem path written. */
  filePath: string;
  /** Public URL relative to the uploads mount, always .svg. */
  publicUrl: string;
  /** Original filename from the profile (for audit). */
  originalFilename: string;
  /** Matching prompt — callers can store or log this. */
  prompt: BuiltPrompt;
  /** Stable id from the profile's images[] entry. */
  imageId: string;
  imageType: string;
  sortOrder: number;
  isApproved: boolean;
}

/**
 * Generate SVG placeholders for every image in a profile.
 * Writes to `{rootDir}/members/{profileId}/{basename}.svg`.
 * Returns metadata the seed can feed directly into `idol_images`.
 */
export async function generatePlaceholders(
  profile: IdolProfileJson,
  rootDir: string,
  publicPrefix = '/api/uploads',
): Promise<GeneratedAsset[]> {
  const palette = derivePalette(profile);
  const prompts = buildPromptsForProfile(profile);

  const results: GeneratedAsset[] = [];
  for (let i = 0; i < profile.images.length; i++) {
    const img = profile.images[i];
    const prompt = prompts[i];
    const baseName = prompt.filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const svgName = `${baseName}.svg`;
    const relative = `members/${profile.id}/${svgName}`;
    const filePath = join(rootDir, relative);
    const svg = renderSvg({
      palette,
      stageName: profile.coreIdentity.name.stage_name,
      conceptName: profile.conceptSeed.concept_name,
      imageType: prompt.imageType,
      aspect: prompt.aspectRatio,
      gender: profile.conceptSeed.gender ?? profile.faceVector.identity.gender_presentation,
    });
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, svg, 'utf8');
    results.push({
      filePath,
      publicUrl: `${publicPrefix}/${relative}`,
      originalFilename: prompt.filename,
      prompt,
      imageId: img.id,
      imageType: img.imageType,
      sortOrder: img.sortOrder,
      isApproved: img.isApproved,
    });
  }
  return results;
}
