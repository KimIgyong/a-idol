import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfig, loadConfig } from './config.schema';

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true })],
  providers: [
    {
      provide: AppConfig,
      useFactory: () => loadConfig(),
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
