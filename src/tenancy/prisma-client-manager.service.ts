import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma-tenant/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertSafeSchemaName } from './schema-name.util';

/**
 * Caches one tenant PrismaClient per Postgres schema. Each cached client
 * owns its own small connection pool pinned to that schema at construction
 * time (via adapter-pg's `schema` option — a `?schema=` query param on the
 * connection string is silently ignored by the driver adapter, see
 * TenantPrismaService). Isolation is enforced at the connection level, not
 * by per-query discipline: a shared pool with a per-request `SET search_path`
 * would be fragile since pg.Pool reuses physical connections across
 * unrelated requests.
 */
@Injectable()
export class PrismaClientManager implements OnModuleDestroy {
  private readonly clients = new Map<string, PrismaClient>();

  constructor(private readonly configService: ConfigService) {}

  async getClient(schemaName: string): Promise<PrismaClient> {
    assertSafeSchemaName(schemaName);

    const cached = this.clients.get(schemaName);
    if (cached) {
      return cached;
    }

    const client = this.createClient(schemaName);
    await client.$connect();
    this.clients.set(schemaName, client);
    return client;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.clients.values()).map((client) => client.$disconnect()),
    );
    this.clients.clear();
  }

  /** Extracted so tests can stub client creation without a real Postgres connection. */
  protected createClient(schemaName: string): PrismaClient {
    return new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: this.configService.get<string>(
            'TENANT_DATABASE_URL',
          ),
          max: 5,
        },
        { schema: schemaName },
      ),
    });
  }
}
