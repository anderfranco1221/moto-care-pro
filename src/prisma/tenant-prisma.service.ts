import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma-tenant/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Single-connection placeholder client for the tenant Prisma project
 * (Motorcycle/Service/Appointment), pinned to TENANT_DATABASE_URL.
 * Fase 2 will replace this construction with PrismaClientManager-backed
 * per-tenant routing (see prisma/tenant/schema.prisma); the injection
 * point in consumers (e.g. MotorcyclesService) stays the same.
 */
@Injectable()
export class TenantPrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg(
        { connectionString: configService.get<string>('TENANT_DATABASE_URL') },
        // `@prisma/adapter-pg` ignores a `?schema=` query param on the
        // connection string — the target schema must be passed explicitly here.
        { schema: configService.get<string>('TENANT_SCHEMA_NAME') },
      ),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
