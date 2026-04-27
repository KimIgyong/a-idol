import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponseDto, AuthTokensDto, UserDto } from '@a-idol/shared';
import { SignupWithEmailUseCase } from '../application/signup-with-email.usecase';
import { LoginWithEmailUseCase } from '../application/login-with-email.usecase';
import { RefreshTokenUseCase } from '../application/refresh-token.usecase';
import { LogoutUseCase } from '../application/logout.usecase';
import { GetMeUseCase } from '../application/get-me.usecase';
import { UpdateMeUseCase } from '../application/update-me.usecase';
import { SignupDto } from './dto/signup.dto';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { toAuthResponse, toUserDto } from './dto/user-view';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import { CurrentUser, type CurrentUserContext } from '../../../shared/decorators/current-user.decorator';

@ApiTags('auth')
@Controller()
export class IdentityController {
  constructor(
    private readonly signup: SignupWithEmailUseCase,
    private readonly login: LoginWithEmailUseCase,
    private readonly refresh: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getMe: GetMeUseCase,
    private readonly updateMe: UpdateMeUseCase,
  ) {}

  @Post('auth/signup')
  @ApiOperation({ summary: 'Email sign-up' })
  async postSignup(@Body() body: SignupDto): Promise<AuthResponseDto> {
    const result = await this.signup.execute({
      email: body.email,
      password: body.password,
      nickname: body.nickname,
      birthdate: new Date(body.birthdate),
      deviceId: body.device_id,
    });
    return toAuthResponse(result.user, result);
  }

  @Post('auth/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Email login' })
  async postLogin(@Body() body: LoginDto): Promise<AuthResponseDto> {
    const result = await this.login.execute({
      email: body.email,
      password: body.password,
      deviceId: body.device_id,
    });
    return toAuthResponse(result.user, result);
  }

  @Post('auth/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token → new access + refresh' })
  async postRefresh(@Body() body: RefreshDto): Promise<AuthTokensDto> {
    return this.refresh.execute({ refreshToken: body.refresh_token });
  }

  @Post('auth/logout')
  @HttpCode(200)
  @ApiOperation({
    summary: '서버 측 session revoke. RPT-260426-D T-082 후속. Idempotent (invalid token도 silent OK).',
  })
  async postLogout(@Body() body: RefreshDto): Promise<{ revoked: boolean }> {
    return this.logout.execute({ refreshToken: body.refresh_token });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile' })
  async get(@CurrentUser() user: CurrentUserContext): Promise<UserDto> {
    const u = await this.getMe.execute(user.id);
    return toUserDto(u);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update self profile (avatar / consents). RPT-260426-C SCR-004 + 설정 화면.' })
  async patch(
    @CurrentUser() user: CurrentUserContext,
    @Body() body: UpdateMeDto,
  ): Promise<UserDto> {
    const u = await this.updateMe.execute(user.id, {
      avatarUrl: body.avatar_url,
      marketingOptIn: body.marketing_opt_in,
      pushOptIn: body.push_opt_in,
    });
    return toUserDto(u);
  }
}
