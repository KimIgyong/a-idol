/**
 * Text-to-image prompt composer for idol personas.
 *
 * Takes a full IdolProfileJson (conceptSeed + faceVector + fashion) and emits
 * a prompt per image type (hero / portrait / editorial / lifestyle / emotional
 * / concept / headshot / character_sheet variants). The output is model-
 * agnostic — the prompts are written as natural-language scene descriptions
 * with structured fields that work for SDXL, Midjourney, or a closed-source
 * image model, and include a shared `negative` term set and a `style` hint
 * that the caller can map to its own model's parameters.
 */

import type { IdolImageType, IdolProfileJson } from './idol-profile.types';

export interface BuiltPrompt {
  imageType: string;             // covers base types + character-sheet variants
  filename: string;              // canonical filename, matches the seeded URL
  prompt: string;
  negative: string;
  aspectRatio: string;
  style: string;                 // e.g. "editorial moody", "cinematic"
  seed: number;                  // deterministic per idol+type so reruns match
}

const BASE_NEGATIVE = [
  'low quality', 'blurry', 'jpeg artifacts', 'deformed face',
  'extra fingers', 'mutated hands', 'disfigured', 'watermark',
  'text', 'signature', 'frame', 'border', 'low resolution',
  'oversaturated', 'poorly drawn face',
].join(', ');

/** Flat scalar bucket helper — turns a 0..1 number into a descriptive adverb. */
function bucket(v: number, labels: [string, string, string]): string {
  if (v < 0.4) return labels[0];
  if (v < 0.7) return labels[1];
  return labels[2];
}

/** Hash a string to a deterministic 31-bit seed. */
function seedFrom(...parts: string[]): number {
  let h = 2166136261;
  for (const s of parts) {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function describeIdentity(p: IdolProfileJson): string {
  const id = p.faceVector.identity;
  const style = p.faceVector.default_styling;
  const physical = p.coreIdentity.physical;
  const gender = id.gender_presentation; // "masculine" / "feminine"

  const parts = [
    `${id.overall_age_appearance}-year-old ${p.coreIdentity.personal.ethnicity} ${gender}-presenting person`,
    `${id.face_shape} face shape`,
    `${id.eye_shape} ${id.eye_color} eyes (${bucket(id.eye_size, ['small', 'medium', 'large'])}, ${bucket(id.eye_tilt, ['downturned', 'neutral', 'upturned'])})`,
    `${id.brow_shape} brows, ${bucket(id.brow_thickness, ['thin', 'medium', 'thick'])}`,
    `${id.nose_tip ?? 'soft'} nose (${bucket(id.nose_width, ['narrow', 'medium', 'wide'])}), ${bucket(id.nose_bridge_height, ['low', 'medium', 'high'])} bridge`,
    `${id.lip_shape} lips, ${bucket(id.lip_fullness, ['thin', 'medium', 'full'])}`,
    `${id.skin_tone} ${id.skin_texture} skin`,
    `${bucket(id.jaw_definition, ['soft', 'defined', 'sharp'])} jawline`,
    `${bucket(id.cheekbone_prominence, ['subtle', 'defined', 'prominent'])} cheekbones`,
    `${id.chin_shape} chin`,
    `${style.hair_length} ${style.hair_texture} ${style.hair_style}, ${style.hair_color} hair`,
    `height ~${physical.height_cm}cm`,
  ];

  const features = physical.distinguishing_features;
  if (features) parts.push(`distinguishing feature: ${features}`);
  if (style.distinguishing_marks && style.distinguishing_marks !== 'none') {
    parts.push(style.distinguishing_marks);
  }
  return parts.join(', ');
}

function describeConcept(p: IdolProfileJson): string {
  const c = p.conceptSeed;
  return `Concept: "${c.concept_name}" — ${c.visual_mood} Overall vibe: ${c.vibe_description}`;
}

/** Returns the prompt config for a specific image type. */
function promptForType(p: IdolProfileJson, type: string, filename: string): BuiltPrompt {
  const identity = describeIdentity(p);
  const concept = describeConcept(p);
  const fashion = p.deepProfile.fashion ?? {};
  const stageName = p.coreIdentity.name.stage_name;
  const seed = seedFrom(p.id, type, filename);

  // imageType-specific composition
  const recipes: Record<
    string,
    { scene: string; style: string; aspectRatio: string; extra?: string }
  > = {
    hero: {
      scene: `Cinematic hero shot of ${stageName}, three-quarter body, dramatic studio lighting with a soft key and moody rim light, confident thoughtful gaze toward the camera, stage outfit: ${fashion.stage_style ?? 'refined editorial styling'}. Shallow depth of field, centered composition suitable as a vertical app hero image. ${concept}`,
      style: 'high-end K-pop editorial, cinematic, 35mm lens, f/2.8',
      aspectRatio: '9:16',
    },
    portrait: {
      scene: `Studio portrait of ${stageName}, chest-up, even softbox lighting, neutral mid-grey backdrop, relaxed natural expression, styled hair and minimal makeup emphasizing natural features. Outfit: ${fashion.casual_style ?? 'minimal layered casual'}.`,
      style: 'clean studio portrait, 85mm, f/2.0, natural skin retouch',
      aspectRatio: '4:5',
    },
    editorial: {
      scene: `High-fashion editorial shot of ${stageName}, unusual framing (low angle or reflection), textured backdrop, theatrical lighting with hard shadows, magazine cover aesthetic. Stage styling: ${fashion.stage_style ?? 'editorial'}. Inspiration: ${fashion.fashion_inspirations ?? 'avant-garde street fashion'}.`,
      style: 'Vogue editorial, film grain, moody contrast',
      aspectRatio: '4:5',
    },
    lifestyle: {
      scene: `Candid lifestyle shot of ${stageName} in a natural everyday setting (studio cafe, city street, or rehearsal space), relaxed smile or thoughtful profile, soft daylight through window. Casual outfit: ${fashion.casual_style ?? 'oversized hoodie and loose denim'}. Genuine, unposed energy.`,
      style: 'documentary lifestyle, natural light, muted earth tones',
      aspectRatio: '3:4',
    },
    emotional: {
      scene: `Intimate emotional close-up of ${stageName}, soft tearful or quietly joyful expression, window-side natural light with dust particles in the air, eyes catching the light. Very shallow depth of field, extreme empathy with the subject.`,
      style: 'cinematic emotion, golden hour, film-like grain',
      aspectRatio: '4:5',
    },
    concept: {
      scene: `Concept visual of ${stageName} embodying the "${p.conceptSeed.concept_name}" concept. ${p.conceptSeed.visual_mood} Environment and props reinforce the concept. Symbolic composition.`,
      style: 'art-directed concept photo, stylized color palette',
      aspectRatio: '3:4',
    },
    headshot: {
      scene: `Clean agency headshot of ${stageName}, shoulders-up, direct eye contact, neutral seamless backdrop, flat even lighting for catalog use. Subtle natural makeup. Suitable as a thumbnail.`,
      style: 'commercial headshot, sharp focus, crisp detail',
      aspectRatio: '1:1',
    },
    'character_sheet/cs_face_angles': {
      scene: `Character reference sheet: four angles of ${stageName}'s face (front, 3/4 left, profile left, tilt up). Neutral expression. Flat even lighting, labeled grid layout, reference-style.`,
      style: 'character design reference sheet, flat illustration style',
      aspectRatio: '16:9',
      extra: 'This is an internal art-direction asset, not a fan-facing image.',
    },
    'character_sheet/cs_expressions': {
      scene: `Expression sheet: six small portraits of ${stageName} showing different expressions (neutral, gentle smile, laughing, thoughtful, surprised, focused). Labeled grid.`,
      style: 'character design reference sheet',
      aspectRatio: '16:9',
      extra: 'Internal reference only.',
    },
    'character_sheet/cs_fullbody_angles': {
      scene: `Full-body reference sheet: three angles (front, side, back) of ${stageName} in neutral T-pose wearing simple stage outfit, labeled grid layout.`,
      style: 'character design reference sheet',
      aspectRatio: '3:4',
      extra: 'Internal reference only.',
    },
    'character_sheet/cs_three_quarter': {
      scene: `Three-quarter angle full-body reference of ${stageName}, stage outfit, reference pose with arms slightly out, labeled axes.`,
      style: 'character design reference sheet',
      aspectRatio: '3:4',
      extra: 'Internal reference only.',
    },
  };

  const recipe = recipes[type] ?? recipes.portrait;
  const prompt = [
    `Subject: ${identity}.`,
    recipe.scene,
    recipe.extra ?? '',
  ].filter(Boolean).join(' ');

  return {
    imageType: type,
    filename,
    prompt,
    negative: BASE_NEGATIVE,
    aspectRatio: recipe.aspectRatio,
    style: recipe.style,
    seed,
  };
}

/**
 * Build prompts for every `images[]` entry in the profile, using the filename
 * to discriminate between character_sheet variants.
 */
export function buildPromptsForProfile(profile: IdolProfileJson): BuiltPrompt[] {
  return profile.images.map((img) => {
    const filename = img.imageUrl.split('/').pop() ?? `${img.imageType}.jpg`;
    const baseName = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const typeKey =
      img.imageType === 'character_sheet'
        ? `character_sheet/${baseName}` // e.g. "character_sheet/cs_face_angles"
        : img.imageType;
    return promptForType(profile, typeKey, filename);
  });
}

/** Overload for generating a single prompt by logical type (not filename-based). */
export function buildPromptForType(profile: IdolProfileJson, type: IdolImageType): BuiltPrompt {
  const fallbackFile = `${type}.jpg`;
  return promptForType(profile, type, fallbackFile);
}
