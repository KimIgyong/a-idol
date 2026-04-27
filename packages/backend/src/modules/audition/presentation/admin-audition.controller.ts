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
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuditionDto,
  AuditionEntryDto,
  AuditionListItemDto,
  RoundDto,
  VoteRuleDto,
} from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import {
  AddEntriesUseCase,
  CreateAuditionUseCase,
  DeleteAuditionUseCase,
  GetAuditionUseCase,
  ListAuditionsUseCase,
  RemoveEntryUseCase,
  TransitionAuditionUseCase,
  UpdateAuditionUseCase,
} from '../application/audition.usecases';
import {
  CreateRoundUseCase,
  DeleteRoundUseCase,
  TransitionRoundUseCase,
  UpdateRoundUseCase,
} from '../application/round.usecases';
import {
  DeleteVoteRuleUseCase,
  GetVoteRuleUseCase,
  UpsertVoteRuleUseCase,
} from '../application/vote-rule.usecases';
import {
  AddEntriesBody,
  CreateAuditionBody,
  CreateRoundBody,
  UpdateAuditionBody,
  UpdateRoundBody,
  UpsertVoteRuleBody,
} from './dto/audition.dto';
import {
  toAuditionDto,
  toAuditionListItemDto,
  toEntryDto,
  toRoundDto,
  toVoteRuleDto,
} from './dto/audition-view';

@ApiTags('admin-audition')
@Controller('admin/auditions')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminAuditionController {
  constructor(
    private readonly createAudition: CreateAuditionUseCase,
    private readonly listAuditions: ListAuditionsUseCase,
    private readonly getAudition: GetAuditionUseCase,
    private readonly updateAudition: UpdateAuditionUseCase,
    private readonly transitionAudition: TransitionAuditionUseCase,
    private readonly deleteAudition: DeleteAuditionUseCase,
    private readonly addEntries: AddEntriesUseCase,
    private readonly removeEntry: RemoveEntryUseCase,
    private readonly createRound: CreateRoundUseCase,
    private readonly updateRound: UpdateRoundUseCase,
    private readonly transitionRound: TransitionRoundUseCase,
    private readonly deleteRound: DeleteRoundUseCase,
    private readonly upsertVoteRule: UpsertVoteRuleUseCase,
    private readonly getVoteRule: GetVoteRuleUseCase,
    private readonly deleteVoteRule: DeleteVoteRuleUseCase,
  ) {}

  // -- Audition --------------------------------------------------------
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create audition (DRAFT); optionally seed idol entries' })
  async postAudition(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: CreateAuditionBody,
  ): Promise<AuditionDto> {
    const audition = await this.createAudition.execute({
      name: body.name,
      description: body.description,
      startAt: body.start_at,
      endAt: body.end_at,
      idolIds: body.idol_ids,
      createdBy: admin.id,
    });
    const detail = await this.getAudition.execute(audition.id);
    return toAuditionDto(detail);
  }

  @Get()
  @ApiOperation({ summary: 'List all auditions (admin; includes drafts, finished, canceled)' })
  async getAuditions(): Promise<AuditionListItemDto[]> {
    const list = await this.listAuditions.executeAdmin();
    return list.map(toAuditionListItemDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Audition detail (admin)' })
  async getAuditionById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AuditionDto> {
    const detail = await this.getAudition.execute(id);
    return toAuditionDto(detail);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update audition (DRAFT or ACTIVE only)' })
  async patchAudition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAuditionBody,
  ): Promise<AuditionDto> {
    await this.updateAudition.execute(id, {
      name: body.name,
      description: body.description,
      startAt: body.start_at,
      endAt: body.end_at,
    });
    const detail = await this.getAudition.execute(id);
    return toAuditionDto(detail);
  }

  @Post(':id/activate')
  @HttpCode(200)
  async postActivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<AuditionDto> {
    await this.transitionAudition.execute(id, 'ACTIVE');
    const detail = await this.getAudition.execute(id);
    return toAuditionDto(detail);
  }

  @Post(':id/finish')
  @HttpCode(200)
  async postFinish(@Param('id', new ParseUUIDPipe()) id: string): Promise<AuditionDto> {
    await this.transitionAudition.execute(id, 'FINISHED');
    const detail = await this.getAudition.execute(id);
    return toAuditionDto(detail);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('admin')
  async postCancel(@Param('id', new ParseUUIDPipe()) id: string): Promise<AuditionDto> {
    await this.transitionAudition.execute(id, 'CANCELED');
    const detail = await this.getAudition.execute(id);
    return toAuditionDto(detail);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  async removeAudition(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteAudition.execute(id);
  }

  // -- Entries ---------------------------------------------------------
  @Post(':id/entries')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add idols to this audition (bulk; rejects dupes)' })
  async postEntries(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AddEntriesBody,
  ): Promise<AuditionEntryDto[]> {
    const res = await this.addEntries.execute(id, body.idol_ids);
    return res.map(toEntryDto);
  }

  @Delete(':id/entries/:idolId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove idol from this audition (DRAFT only)' })
  async removeEntryById(
    @Param('id', new ParseUUIDPipe()) auditionId: string,
    @Param('idolId', new ParseUUIDPipe()) idolId: string,
  ): Promise<void> {
    await this.removeEntry.execute(auditionId, idolId);
  }

  // -- Rounds ----------------------------------------------------------
  @Post(':id/rounds')
  @HttpCode(201)
  async postRound(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateRoundBody,
  ): Promise<RoundDto> {
    const r = await this.createRound.execute(id, {
      name: body.name,
      orderIndex: body.order_index,
      startAt: body.start_at,
      endAt: body.end_at,
      maxAdvancers: body.max_advancers,
    });
    return toRoundDto(r);
  }

  @Patch('/rounds/:roundId')
  async patchRound(
    @Param('roundId', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateRoundBody,
  ): Promise<RoundDto> {
    const r = await this.updateRound.execute(id, {
      name: body.name,
      orderIndex: body.order_index,
      startAt: body.start_at,
      endAt: body.end_at,
      maxAdvancers: body.max_advancers,
    });
    return toRoundDto(r);
  }

  @Post('/rounds/:roundId/activate')
  @HttpCode(200)
  async postRoundActivate(
    @Param('roundId', new ParseUUIDPipe()) id: string,
  ): Promise<RoundDto> {
    const r = await this.transitionRound.execute(id, 'ACTIVE');
    return toRoundDto(r);
  }

  @Post('/rounds/:roundId/close')
  @HttpCode(200)
  async postRoundClose(
    @Param('roundId', new ParseUUIDPipe()) id: string,
  ): Promise<RoundDto> {
    const r = await this.transitionRound.execute(id, 'CLOSED');
    return toRoundDto(r);
  }

  @Delete('/rounds/:roundId')
  @HttpCode(204)
  @Roles('admin')
  async removeRound(@Param('roundId', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteRound.execute(id);
  }

  // -- Vote Rule (per-round) -------------------------------------------
  @Put('/rounds/:roundId/vote-rule')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create/update vote rule (SCHEDULED rounds only)' })
  async putVoteRule(
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @Body() body: UpsertVoteRuleBody,
  ): Promise<VoteRuleDto> {
    const rec = await this.upsertVoteRule.execute(roundId, {
      heartWeight: body.heart_weight,
      smsWeight: body.sms_weight,
      ticketWeight: body.ticket_weight,
      dailyHeartLimit: body.daily_heart_limit,
    });
    return toVoteRuleDto(rec);
  }

  @Get('/rounds/:roundId/vote-rule')
  async getRoundVoteRule(
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<VoteRuleDto> {
    const rec = await this.getVoteRule.execute(roundId);
    return toVoteRuleDto(rec);
  }

  @Delete('/rounds/:roundId/vote-rule')
  @HttpCode(204)
  @Roles('admin')
  async removeVoteRule(
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<void> {
    await this.deleteVoteRule.execute(roundId);
  }
}
