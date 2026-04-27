import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponseDto, AuthTokensDto, UserDto } from '@a-idol/shared';
import { SignupWithEmailUseCase } from '../application/signup-with-email.usecase';
import { LoginWithEmailUseCase } from '../application/login-with-email.usecase';
import { RefreshTokenUseCase } from '../application/refresh-token.usecase';
import { GetMeUseCase } from '../application/get-me.usecase';
import { SignupDto } from './dto/signup.dto';
import { LoginDto, RefreshDto } from './dto/login.dto';
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
    private readonly getMe: GetMeUseCase,
  ) {}

  @Post('auth/signup')
  @ApiOperation({ summary: 'Email sign-up' })
  async postSignup(@Body() body: SignupDto): Promise<AuthResponseDto> {
    const result = await this.signup.execute({
      email: body.email,
      password: body.password,
      nickname: body.nickname,
      birthdate: new Date(body.birthdate),
      deviceId: body.deviceId,
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
      deviceId: body.deviceId,
    });
    return toAuthResponse(result.user, result);
  }

  @Post('auth/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token → new access + refresh' })
  async postRefresh(@Body() body: RefreshDto): Promise<AuthTokensDto> {
    return this.refresh.execute({ refreshToken: body.refreshToken });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile' })
  async get(@CurrentUser() user: CurrentUserContext): Promise<UserDto> {
    const u = await this.getMe.execute(user.id);
    return toUserDto(u);
  }
}
