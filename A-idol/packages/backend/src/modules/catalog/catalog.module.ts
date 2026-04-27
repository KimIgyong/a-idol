import { Module } from '@nestjs/common';
import { CatalogController } from './presentation/catalog.controller';
import { ListIdolsUseCase, IDOL_REPOSITORY } from './application/list-idols.usecase';
import { PrismaIdolRepository } from './infrastructure/prisma-idol.repository';

@Module({
  controllers: [CatalogController],
  providers: [
    ListIdolsUseCase,
    { provide: IDOL_REPOSITORY, useClass: PrismaIdolRepository },
  ],
})
export class CatalogModule {}
