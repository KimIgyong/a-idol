import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUserDto } from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import { ListOperatorsUseCase } from '../application/list-operators.usecase';
import { UnlockAccountUseCase } from '../application/unlock-account.usecase';
import { toAdminUserDto } from './dto/admin-user-view';

class UnlockAccountDto {
  @IsEmail()
  email!: string;
}

/**
 * 운영자 (admin / operator / viewer) 관리 — read-only list 우선 (RPT-260426-B
 * §5). 이 controller는 admin role 전용이라 viewer/operator가 같은 endpoint를
 * 호출하면 RolesGuard가 403으로 거부.
 *
 * 추가: T-082 후속 — 잠긴 계정 즉시 해제 (CS workflow §6.2).
 */
@ApiTags('admin-operators')
@Controller('admin/operators')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminOperatorsController {
  constructor(
    private readonly listOperators: ListOperatorsUseCase,
    private readonly unlockAccount: UnlockAccountUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all operators (admin/operator/viewer roles)' })
  async getOperators(): Promise<AdminUserDto[]> {
    const rows = await this.listOperators.execute();
    return rows.map(toAdminUserDto);
  }

  @Post('unlock-account')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'T-082: 잠긴 계정 즉시 해제 (NIST §5.2.2 lockout 우회). admin role 전용 + audit log 자동 기록.',
  })
  async postUnlockAccount(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: UnlockAccountDto,
  ): Promise<{ unlocked: true }> {
    await this.unlockAccount.execute({
      targetEmail: body.email,
      actorAdminId: admin.id,
    });
    return { unlocked: true };
  }
}
