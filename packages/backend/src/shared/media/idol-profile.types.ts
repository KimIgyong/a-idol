/**
 * Shape of the AI-generated idol persona JSON (see prisma/seeds/*.json).
 * Only the fields we actively consume are typed — the rest flow through as
 * `unknown` on the detail endpoint.
 */

export interface IdolProfileJson {
  id: string;
  conceptSeed: {
    gender: 'male' | 'female' | string;
    visual_mood: string;
    concept_name: string;
    unique_angle?: string;
    emotional_hook?: string;
    vibe_description: string;
  };
  coreIdentity: {
    name: {
      korean: string;
      english: string;
      stage_name: string;
    };
    birth: {
      date: string;
      zodiac?: string;
      raised_in?: string;
      birthplace: string;
    };
    personal: {
      mbti: string;
      ethnicity: string;
    };
    physical: {
      height_cm: number;
      weight_kg: number;
      distinguishing_features: string;
    };
  };
  deepProfile: {
    fashion?: {
      stage_style?: string;
      casual_style?: string;
      airport_fashion?: string;
      fashion_inspirations?: string;
      signature_accessories?: string;
    };
  };
  faceVector: {
    identity: {
      eye_size: number;
      eye_tilt: number;
      eye_color: string;
      eye_shape: string;
      nose_tip?: string;
      lip_shape: string;
      skin_tone: string;
      brow_shape: string;
      chin_shape: string;
      face_shape: string;
      nose_width: number;
      nose_length: number;
      lip_fullness: number;
      skin_texture: string;
      face_symmetry: number;
      brow_thickness: number;
      jaw_definition: number;
      nose_bridge_height: number;
      gender_presentation: string;
      cheekbone_prominence: number;
      overall_age_appearance: number;
    };
    default_styling: {
      lip_color: string;
      hair_color: string;
      hair_style: string;
      hair_length: string;
      hair_texture: string;
      eyelash_density: number;
      distinguishing_marks: string;
    };
  };
  images: Array<{
    id: string;
    imageType: string;
    imageUrl: string;
    isApproved: boolean;
    sortOrder: number;
  }>;
}

export type IdolImageType =
  | 'hero'
  | 'portrait'
  | 'editorial'
  | 'lifestyle'
  | 'emotional'
  | 'concept'
  | 'headshot'
  | 'character_sheet';
