import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { ReconcileLeaderboardUseCase } from '../application/reconcile-leaderboard.usecase';
import { SnapshotRankingUseCase } from '../application/snapshot-ranking.usecase';

@ApiTags('admin-vote')
@Controller('admin/rounds')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminVoteController {
  constructor(
    private readonly reconcile: ReconcileLeaderboardUseCase,
    private readonly snapshot: SnapshotRankingUseCase,
  ) {}

  @Post(':id/reconcile-leaderboard')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Rebuild Redis leaderboard ZSET from the Vote audit table (disaster recovery — ADR-014)',
  })
  async postReconcile(
    @Param('id', new ParseUUIDPipe()) roundId: string,
  ): Promise<{
    roundId: string;
    sourceRows: number;
    entriesWritten: number;
    totalScore: number;
    completedAt: string;
  }> {
    const r = await this.reconcile.execute(roundId);
    return { ...r, completedAt: r.completedAt.toISOString() };
  }

  @Post(':id/snapshot')
  @Roles('admin', 'operator')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Force an immediate ranking snapshot write (bypasses 5-min cron)',
  })
  async postSnapshot(
    @Param('id', new ParseUUIDPipe()) roundId: string,
  ): Promise<{ roundId: string; rows: number; snapshotAt: string }> {
    const r = await this.snapshot.execute(roundId);
    return { ...r, snapshotAt: r.snapshotAt.toISOString() };
  }
}
