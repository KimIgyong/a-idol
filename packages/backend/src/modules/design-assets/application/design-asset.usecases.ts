import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateDesignAssetInput,
  DesignAssetRecord,
  DesignAssetRepository,
  UpdateDesignAssetInput,
} from './interfaces';
import { DESIGN_ASSET_REPOSITORY } from './interfaces';

@Injectable()
export class ListDesignAssetsUseCase {
  constructor(
    @Inject(DESIGN_ASSET_REPOSITORY) private readonly repo: DesignAssetRepository,
  ) {}
  execute(): Promise<DesignAssetRecord[]> {
    return this.repo.list();
  }
}

@Injectable()
export class CreateDesignAssetUseCase {
  constructor(
    @Inject(DESIGN_ASSET_REPOSITORY) private readonly repo: DesignAssetRepository,
  ) {}
  execute(input: CreateDesignAssetInput): Promise<DesignAssetRecord> {
    return this.repo.create(input);
  }
}

@Injectable()
export class UpdateDesignAssetUseCase {
  constructor(
    @Inject(DESIGN_ASSET_REPOSITORY) private readonly repo: DesignAssetRepository,
  ) {}
  async execute(id: string, input: UpdateDesignAssetInput): Promise<DesignAssetRecord> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: `DesignAsset ${id} not found` });
    return this.repo.update(id, input);
  }
}

@Injectable()
export class DeleteDesignAssetUseCase {
  constructor(
    @Inject(DESIGN_ASSET_REPOSITORY) private readonly repo: DesignAssetRepository,
  ) {}
  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: `DesignAsset ${id} not found` });
    await this.repo.remove(id);
  }
}
