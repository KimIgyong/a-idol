import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/config.schema';
import { IdentityController } from './presentation/identity.controller';
import { SignupWithEmailUseCase } from './application/signup-with-email.usecase';
import { LoginWithEmailUseCase } from './application/login-with-email.usecase';
import { RefreshTokenUseCase } from './application/refresh-token.usecase';
import { GetMeUseCase } from './application/get-me.usecase';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaAuthSessionRepository } from './infrastructure/prisma-auth-session.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import {
  AUTH_SESSION_REPOSITORY,
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
    GetMeUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: AUTH_SESSION_REPOSITORY, useClass: PrismaAuthSessionRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    JwtTokenService,
  ],
  exports: [JwtTokenService],
})
export class IdentityModule {}
