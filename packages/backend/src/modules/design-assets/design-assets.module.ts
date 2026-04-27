import { Module } from '@nestjs/common';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { AdminDesignAssetsController } from './presentation/admin-design-assets.controller';
import {
  CreateDesignAssetUseCase,
  DeleteDesignAssetUseCase,
  ListDesignAssetsUseCase,
  UpdateDesignAssetUseCase,
} from './application/design-asset.usecases';
import { DESIGN_ASSET_REPOSITORY } from './application/interfaces';
import { PrismaDesignAssetRepository } from './infrastructure/prisma-design-asset.repository';

@Module({
  imports: [AdminOpsModule],
  controllers: [AdminDesignAssetsController],
  providers: [
    ListDesignAssetsUseCase,
    CreateDesignAssetUseCase,
    UpdateDesignAssetUseCase,
    DeleteDesignAssetUseCase,
    { provide: DESIGN_ASSET_REPOSITORY, useClass: PrismaDesignAssetRepository },
  ],
})
export class DesignAssetsModule {}
