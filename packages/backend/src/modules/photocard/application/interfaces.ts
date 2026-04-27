import type { PhotocardRarity } from '@a-idol/shared';
import type { PhotocardSource } from '@a-idol/shared';

export interface PhotocardTemplateRecord {
  id: string;
  setId: string;
  name: string;
  imageUrl: string | null;
  rarity: PhotocardRarity;
  dropWeight: number;
  isActive: boolean;
}

export interface PhotocardSetRecord {
  id: string;
  name: string;
  description: string | null;
  idolId: string | null;
  idolName: string | null;
  isActive: boolean;
  templates: PhotocardTemplateRecord[];
}

/**
 * One row per distinct template the user owns. `count` is the number of
 * copies. See T-046b.
 */
export interface UserPhotocardRecord {
  templateId: string;
  templateName: string;
  imageUrl: string | null;
  rarity: PhotocardRarity;
  setId: string;
  setName: string;
  count: number;
  firstObtainedAt: Date;
  lastObtainedAt: Date;
}

export interface GrantResult {
  granted: Array<{ templateId: string; templateName: string; rarity: PhotocardRarity }>;
}

export interface PhotocardRepository {
  listSets(opts: { activeOnly: boolean }): Promise<PhotocardSetRecord[]>;
  findSetById(id: string): Promise<PhotocardSetRecord | null>;
  createSet(input: {
    name: string;
    description: string | null;
    idolId: string | null;
  }): Promise<PhotocardSetRecord>;
  updateSet(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      idolId?: string | null;
      isActive?: boolean;
    },
  ): Promise<PhotocardSetRecord>;
  addTemplate(
    setId: string,
    input: {
      name: string;
      imageUrl: string | null;
      rarity: PhotocardRarity;
      dropWeight: number;
    },
  ): Promise<PhotocardTemplateRecord>;
  /**
   * Atomically roll `count` templates from `setId`, weighted by each active
   * template's `dropWeight`, and insert them into `UserPhotocard`. The caller
   * supplies the RNG so tests can pin the distribution. Returns the granted
   * template rows (for the fulfiller to log).
   *
   * Throws `PHOTOCARD_SET_NOT_FOUND` / `PHOTOCARD_SET_EMPTY` on invalid set.
   */
  grantFromSet(input: {
    userId: string;
    setId: string;
    count: number;
    source: PhotocardSource;
    sourceRef: string | null;
    rng?: () => number;
  }): Promise<GrantResult>;
  listUserInventory(userId: string, take: number): Promise<UserPhotocardRecord[]>;
}

export const PHOTOCARD_REPOSITORY = 'PhotocardRepository';
