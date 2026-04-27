import type {
  DesignAssetPlatform,
  DesignAssetStatus,
  DesignAssetType,
} from '@a-idol/shared';

export interface DesignAssetRecord {
  id: string;
  name: string;
  type: DesignAssetType;
  platform: DesignAssetPlatform;
  status: DesignAssetStatus;
  fileUrl: string | null;
  spec: string | null;
  orderIndex: number;
  caption: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDesignAssetInput {
  name: string;
  type: DesignAssetType;
  platform?: DesignAssetPlatform;
  status?: DesignAssetStatus;
  fileUrl?: string | null;
  spec?: string | null;
  orderIndex?: number;
  caption?: string | null;
  notes?: string | null;
  createdBy: string;
}

export interface UpdateDesignAssetInput {
  name?: string;
  type?: DesignAssetType;
  platform?: DesignAssetPlatform;
  status?: DesignAssetStatus;
  fileUrl?: string | null;
  spec?: string | null;
  orderIndex?: number;
  caption?: string | null;
  notes?: string | null;
  updatedBy: string;
}

export interface DesignAssetRepository {
  list(): Promise<DesignAssetRecord[]>;
  findById(id: string): Promise<DesignAssetRecord | null>;
  create(input: CreateDesignAssetInput): Promise<DesignAssetRecord>;
  update(id: string, input: UpdateDesignAssetInput): Promise<DesignAssetRecord>;
  remove(id: string): Promise<void>;
}

export const DESIGN_ASSET_REPOSITORY = 'DesignAssetRepository';
