import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './shared/errors/app-exception.filter';
import { AppConfig } from './config/config.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const cfg = app.get(AppConfig);

  app.enableCors({
    origin: cfg.corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: false });

  // OpenAPI
  const config = new DocumentBuilder()
    .setTitle('A-idol API')
    .setDescription('AI Idol Fandom Platform — Backend API (MVP)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  await app.listen(cfg.port);
  // eslint-disable-next-line no-console
  console.log(`🎤  A-idol backend listening on http://localhost:${cfg.port}  (env=${cfg.nodeEnv})`);
}

void bootstrap();
