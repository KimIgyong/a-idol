import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityController } from './presentation/identity.controller';
import { SignupWithEmailUseCase } from './application/signup-with-email.usecase';
import { LoginWithEmailUseCase } from './application/login-with-email.usecase';
import { RefreshTokenUseCase } from './application/refresh-token.usecase';
import { LogoutUseCase } from './application/logout.usecase';
import { GetMeUseCase } from './application/get-me.usecase';
import { UpdateMeUseCase } from './application/update-me.usecase';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaAuthSessionRepository } from './infrastructure/prisma-auth-session.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { HibpPasswordChecker } from './infrastructure/hibp-password-checker';
import { RedisLoginAttemptThrottle } from './infrastructure/redis-login-attempt-throttle';
import {
  AUTH_SESSION_REPOSITORY,
  BREACH_PASSWORD_CHECKER,
  LOGIN_ATTEMPT_THROTTLE,
  PASSWORD_HASHER,
  TOKEN_SERVICE,
  USER_REPOSITORY,
} from './application/interfaces';

@Module({
  imports: [JwtModule.register({})],
  controllers: [IdentityController],
  providers: [
    SignupWithEmailUseCase,
    LoginWithEmailUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetMeUseCase,
    UpdateMeUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: AUTH_SESSION_REPOSITORY, useClass: PrismaAuthSessionRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: BREACH_PASSWORD_CHECKER, useClass: HibpPasswordChecker },
    { provide: LOGIN_ATTEMPT_THROTTLE, useClass: RedisLoginAttemptThrottle },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    JwtTokenService,
  ],
  exports: [JwtTokenService, LOGIN_ATTEMPT_THROTTLE],
})
export class IdentityModule {}
