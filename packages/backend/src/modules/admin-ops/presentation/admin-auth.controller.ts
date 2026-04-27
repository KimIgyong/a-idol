import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminAuthResponseDto, AdminUserDto, AuthTokensDto } from '@a-idol/shared';
import { LoginAdminUseCase } from '../application/login-admin.usecase';
import { GetAdminMeUseCase } from '../application/get-admin-me.usecase';
import { RefreshAdminTokenUseCase } from '../application/refresh-admin-token.usecase';
import { LogoutAdminUseCase } from '../application/logout-admin.usecase';
import { AdminLoginDto, AdminRefreshDto } from './dto/admin-login.dto';
import { toAdminAuthResponse, toAdminUserDto } from './dto/admin-user-view';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly login: LoginAdminUseCase,
    private readonly getMe: GetAdminMeUseCase,
    private readonly refresh: RefreshAdminTokenUseCase,
    private readonly logout: LogoutAdminUseCase,
  ) {}

  @Post('login')
  @HttpCode(200)
  // T-082 — 관리자 로그인은 사용자보다 엄격한 brute-force 한도. 글로벌 200/min/IP
  // override → 10/min/IP. CMS 운영자가 정상 사용 시 충분, 자동 사전 공격은 차단.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin login (10 req/min/IP)' })
  async postLogin(@Body() body: AdminLoginDto): Promise<AdminAuthResponseDto> {
    const result = await this.login.execute({ email: body.email, password: body.password });
    return toAdminAuthResponse(result.user, result);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate admin refresh token → new access + refresh' })
  async postRefresh(@Body() body: AdminRefreshDto): Promise<AuthTokensDto> {
    return this.refresh.execute({ refreshToken: body.refreshToken });
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Server-side admin session revoke. Idempotent (invalid token도 silent OK).',
  })
  async postLogout(@Body() body: AdminRefreshDto): Promise<{ revoked: boolean }> {
    return this.logout.execute({ refreshToken: body.refreshToken });
  }
}

@ApiTags('admin-auth')
@Controller('admin')
export class AdminMeController {
  constructor(private readonly getMe: GetAdminMeUseCase) {}

  @Get('me')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current admin profile' })
  async get(@CurrentAdmin() admin: CurrentAdminContext): Promise<AdminUserDto> {
    const found = await this.getMe.execute(admin.id);
    return toAdminUserDto(found);
  }
}
