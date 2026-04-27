import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityModule } from '../identity/identity.module';
import { PASSWORD_HASHER } from '../identity/application/interfaces';
import { BcryptPasswordHasher } from '../identity/infrastructure/bcrypt-password-hasher';
import { LoginAdminUseCase } from './application/login-admin.usecase';
import { GetAdminMeUseCase } from './application/get-admin-me.usecase';
import { RefreshAdminTokenUseCase } from './application/refresh-admin-token.usecase';
import { LogoutAdminUseCase } from './application/logout-admin.usecase';
import { UnlockAccountUseCase } from './application/unlock-account.usecase';
import { GetAdminAnalyticsOverviewUseCase } from './application/get-analytics-overview.usecase';
import { ListOperatorsUseCase } from './application/list-operators.usecase';
import {
  ADMIN_AUTH_SESSION_REPOSITORY,
  ADMIN_TOKEN_SERVICE,
  ADMIN_USER_REPOSITORY,
} from './application/interfaces';
import { PrismaAdminUserRepository } from './infrastructure/prisma-admin-user.repository';
import { PrismaAdminAuthSessionRepository } from './infrastructure/prisma-admin-auth-session.repository';
import { AdminJwtTokenService } from './infrastructure/admin-jwt-token.service';
import { AdminAuthController, AdminMeController } from './presentation/admin-auth.controller';
import { AdminAnalyticsController } from './presentation/admin-analytics.controller';
import { AdminOperatorsController } from './presentation/admin-operators.controller';

@Module({
  imports: [IdentityModule, JwtModule.register({})],
  controllers: [
    AdminAuthController,
    AdminMeController,
    AdminAnalyticsController,
    AdminOperatorsController,
  ],
  providers: [
    LoginAdminUseCase,
    GetAdminMeUseCase,
    RefreshAdminTokenUseCase,
    LogoutAdminUseCase,
    UnlockAccountUseCase,
    GetAdminAnalyticsOverviewUseCase,
    ListOperatorsUseCase,
    { provide: ADMIN_USER_REPOSITORY, useClass: PrismaAdminUserRepository },
    { provide: ADMIN_AUTH_SESSION_REPOSITORY, useClass: PrismaAdminAuthSessionRepository },
    { provide: ADMIN_TOKEN_SERVICE, useClass: AdminJwtTokenService },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    AdminJwtTokenService,
  ],
  exports: [AdminJwtTokenService],
})
export class AdminOpsModule {}
