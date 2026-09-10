import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Route Nest's own logs through pino (see src/common/logger.config.ts).
  app.useLogger(app.get(Logger));
  // Without this, Nest's lifecycle hooks (e.g. PrismaClientManager's
  // onModuleDestroy, which disconnects every cached per-tenant client) never
  // run on SIGTERM/SIGINT — only on an explicit app.close() (as in tests).
  app.enableShutdownHooks();

  // Don't advertise the framework.
  (app.getHttpAdapter().getInstance() as Express).disable('x-powered-by');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Moto Care Pro')
    .setDescription('API de gestión de taller de motos')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const configService = app.get(ConfigService);
  await app.listen(configService.get<number>('PORT') ?? 3000);
}
bootstrap();
