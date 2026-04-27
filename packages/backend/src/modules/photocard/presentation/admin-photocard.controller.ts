import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  PhotocardSetDto,
  PhotocardSetListItemDto,
} from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  AddPhotocardTemplateUseCase,
  CreatePhotocardSetUseCase,
  GetPhotocardSetUseCase,
  ListPhotocardSetsUseCase,
  UpdatePhotocardSetUseCase,
} from '../application/usecases';
import {
  AddPhotocardTemplateBody,
  CreatePhotocardSetBody,
  UpdatePhotocardSetBody,
} from './dto/photocard.dto';
import { toSetDto, toSetListItemDto } from './dto/photocard-view';

@ApiTags('admin-photocard')
@Controller('admin/photocards')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminPhotocardController {
  constructor(
    private readonly list: ListPhotocardSetsUseCase,
    private readonly getOne: GetPhotocardSetUseCase,
    private readonly create: CreatePhotocardSetUseCase,
    private readonly update: UpdatePhotocardSetUseCase,
    private readonly addTemplate: AddPhotocardTemplateUseCase,
  ) {}

  @Get('sets')
  @ApiOperation({ summary: 'All photocard sets' })
  async getAll(): Promise<PhotocardSetListItemDto[]> {
    const rows = await this.list.execute({ activeOnly: false });
    return rows.map(toSetListItemDto);
  }

  @Get('sets/:id')
  @ApiOperation({ summary: 'Photocard set detail' })
  async getOneSet(@Param('id', new ParseUUIDPipe()) id: string): Promise<PhotocardSetDto> {
    const row = await this.getOne.execute(id);
    return toSetDto(row);
  }

  @Post('sets')
  @Roles('admin')
  @ApiOperation({ summary: 'Create photocard set' })
  async postSet(@Body() body: CreatePhotocardSetBody): Promise<PhotocardSetDto> {
    const row = await this.create.execute(body);
    return toSetDto(row);
  }

  @Patch('sets/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update photocard set' })
  async patchSet(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePhotocardSetBody,
  ): Promise<PhotocardSetDto> {
    const row = await this.update.execute(id, body);
    return toSetDto(row);
  }

  @Post('sets/:id/templates')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Add a photocard template to a set (returns the refreshed set so dropPercent reflects the new weights; ADR-016)',
  })
  async postTemplate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AddPhotocardTemplateBody,
  ): Promise<PhotocardSetDto> {
    await this.addTemplate.execute(id, body);
    const full = await this.getOne.execute(id);
    return toSetDto(full);
  }
}
