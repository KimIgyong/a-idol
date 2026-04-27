import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DesignAssetDto } from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import {
  CreateDesignAssetUseCase,
  DeleteDesignAssetUseCase,
  ListDesignAssetsUseCase,
  UpdateDesignAssetUseCase,
} from '../application/design-asset.usecases';
import {
  CreateDesignAssetBody,
  UpdateDesignAssetBody,
  toDesignAssetDto,
} from './dto/design-asset.dto';

/**
 * T-085 — App Store / Play 디자인 자산 관리 (CMS UI 백엔드).
 *
 *  - admin/operator 모두 read 허용 (디자이너 협업용 viewer)
 *  - 작성/수정/삭제는 admin only (RolesGuard 추가 override)
 */
@ApiTags('admin-design-assets')
@Controller('admin/design-assets')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminDesignAssetsController {
  constructor(
    private readonly listUC: ListDesignAssetsUseCase,
    private readonly createUC: CreateDesignAssetUseCase,
    private readonly updateUC: UpdateDesignAssetUseCase,
    private readonly deleteUC: DeleteDesignAssetUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: '디자인 자산 목록 (type/platform/orderIndex 정렬)' })
  async list(): Promise<DesignAssetDto[]> {
    const rows = await this.listUC.execute();
    return rows.map(toDesignAssetDto);
  }

  @Post()
  @HttpCode(201)
  @Roles('admin')
  @ApiOperation({ summary: '디자인 자산 생성 (admin only)' })
  async create(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: CreateDesignAssetBody,
  ): Promise<DesignAssetDto> {
    const r = await this.createUC.execute({
      ...body,
      createdBy: admin.id,
    });
    return toDesignAssetDto(r);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: '디자인 자산 수정 (admin only)' })
  async update(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateDesignAssetBody,
  ): Promise<DesignAssetDto> {
    const r = await this.updateUC.execute(id, {
      ...body,
      updatedBy: admin.id,
    });
    return toDesignAssetDto(r);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  @ApiOperation({ summary: '디자인 자산 삭제 (admin only)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteUC.execute(id);
  }
}
