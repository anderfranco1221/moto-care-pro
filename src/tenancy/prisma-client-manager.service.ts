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
  // Caches the in-flight connect Promise, not just the resolved client —
  // two concurrent getClient() calls for the same not-yet-cached schema
  // must await the same connection, not each create their own (a race that
  // would leak an orphaned pool: whichever `set()` "wins" gets kept, the
  // loser is never disconnected).
  private readonly clients = new Map<string, Promise<PrismaClient>>();

  constructor(private readonly configService: ConfigService) {}

  // `async` so an invalid schema name rejects the returned Promise instead
  // of throwing synchronously at the call site — the caller shouldn't have
  // to guess which failure mode `getClient` uses. The validation and cache
  // check/write below still run synchronously (no `await` between them),
  // which is what actually prevents the concurrent-call race.
  async getClient(schemaName: string): Promise<PrismaClient> {
    assertSafeSchemaName(schemaName);

    const cached = this.clients.get(schemaName);
    if (cached) {
      return cached;
    }

    const pending = this.connect(schemaName);
    this.clients.set(schemaName, pending);
    return pending;
  }

  async onModuleDestroy(): Promise<void> {
    const clients = Array.from(this.clients.values());
    this.clients.clear();
    await Promise.all(
      clients.map(async (pending) => (await pending).$disconnect()),
    );
  }

  private async connect(schemaName: string): Promise<PrismaClient> {
    const client = this.createClient(schemaName);
    await client.$connect();
    return client;
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
