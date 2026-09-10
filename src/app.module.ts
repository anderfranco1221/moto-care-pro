import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { ServicesModule } from './modules/services/services.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { SuppliesModule } from './modules/supplies/supplies.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { validateEnv } from './config/env.validation';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { loggerOptions } from './common/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot(loggerOptions()),
    // 100 requests / minute / IP by default; auth routes tighten this with
    // @Throttle() since they're the @Public() attack surface. Disabled when
    // THROTTLE_DISABLED is set (the e2e/unit runs, except the throttle spec).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    PrismaModule,
    MotorcyclesModule,
    ServicesModule,
    AppointmentsModule,
    SuppliesModule,
    AuthModule,
    UsersModule,
    HealthModule,
    TenancyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limit before doing any auth work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
