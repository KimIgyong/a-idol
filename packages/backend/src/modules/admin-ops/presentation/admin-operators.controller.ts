import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { CreateAdminOperatorService } from '../application/create-admin-operator.usecase';
import { UpdateAdminRoleUseCase } from '../application/update-admin-role.usecase';
import { CreateAdminOperatorDto } from './dto/create-admin-operator.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';
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
    private readonly createOperator: CreateAdminOperatorService,
    private readonly updateRole: UpdateAdminRoleUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all operators (admin/operator/viewer roles)' })
  async getOperators(): Promise<AdminUserDto[]> {
    const rows = await this.listOperators.execute();
    return rows.map(toAdminUserDto);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary:
      'FR-102-A: 신규 어드민 등록. admin role 전용. 이메일 초대 없이 즉시 활성. 비밀번호는 운영자 직접 입력.',
  })
  async postCreate(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: CreateAdminOperatorDto,
  ): Promise<AdminUserDto> {
    const created = await this.createOperator.execute({
      actorId: admin.id,
      email: body.email,
      displayName: body.display_name,
      password: body.password,
      role: body.role,
    });
    return toAdminUserDto(created);
  }

  @Patch(':id/role')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'FR-102-B: 어드민 역할 변경. admin role 전용. 자기 자신/마지막 admin 강등 금지, admin ≤ 3.',
  })
  async patchRole(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminRoleDto,
  ): Promise<AdminUserDto> {
    const updated = await this.updateRole.execute({
      actorId: admin.id,
      targetId: id,
      role: body.role,
    });
    return toAdminUserDto(updated);
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
