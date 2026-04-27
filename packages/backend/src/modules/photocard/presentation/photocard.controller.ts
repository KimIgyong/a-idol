import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  PhotocardSetDto,
  PhotocardSetListItemDto,
  UserPhotocardDto,
} from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import {
  GetPhotocardSetUseCase,
  ListMyPhotocardsUseCase,
  ListPhotocardSetsUseCase,
} from '../application/usecases';
import {
  toSetDto,
  toSetListItemDto,
  toUserPhotocardDto,
} from './dto/photocard-view';

@ApiTags('photocard')
@Controller()
export class PhotocardController {
  constructor(
    private readonly listSets: ListPhotocardSetsUseCase,
    private readonly getSet: GetPhotocardSetUseCase,
    private readonly listMine: ListMyPhotocardsUseCase,
  ) {}

  @Get('photocards/sets')
  @ApiOperation({ summary: 'Active photocard sets (public)' })
  async getSets(): Promise<PhotocardSetListItemDto[]> {
    const rows = await this.listSets.execute({ activeOnly: true });
    return rows.map(toSetListItemDto);
  }

  @Get('photocards/sets/:id')
  @ApiOperation({ summary: 'Photocard set detail with all templates (public)' })
  async getSetDetail(@Param('id', new ParseUUIDPipe()) id: string): Promise<PhotocardSetDto> {
    const row = await this.getSet.execute(id);
    return toSetDto(row);
  }

  @Get('me/photocards')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Caller's photocard inventory (most recent first)" })
  async getMine(@CurrentUser() user: CurrentUserContext): Promise<UserPhotocardDto[]> {
    const rows = await this.listMine.execute(user.id, 100);
    return rows.map(toUserPhotocardDto);
  }
}
