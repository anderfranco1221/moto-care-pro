/**
 * Applies the tenant Prisma project's migrations to a Postgres schema.
 * Prisma has no native "replay this migration history against N schemas"
 * command, so this exists as a standalone runbook step. Run directly:
 *
 *   npm run migrate:tenants                  # all tenants in Tenant table
 *   npm run migrate:tenants -- tenant_abc123  # just one schema
 *
 * The actual provisioning logic (provisionTenantSchema) lives in
 * src/tenancy/ and is also called by AuthService.register at signup time —
 * this script is for backfilling existing tenants after a tenant-project
 * schema change (e.g. Fase 3's insumos module), which needs re-running
 * against every existing tenant, not just new ones.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { provisionTenantSchema } from '../src/tenancy/provision-tenant-schema';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

async function migrateAllTenants(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });
  try {
    const tenants = await prisma.tenant.findMany();
    if (tenants.length === 0) {
      console.log('No tenants found — nothing to migrate.');
      return;
    }
    for (const tenant of tenants) {
      console.log(
        `\n--- Migrating schema "${tenant.schemaName}" (tenant ${tenant.name}) ---`,
      );
      await provisionTenantSchema(tenant.schemaName);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const schemaArg = process.argv[2];
  const run = schemaArg ? provisionTenantSchema(schemaArg) : migrateAllTenants();

  run.catch((error: unknown) => {
    // Fail loud and stop on the first error — don't silently skip a broken
    // tenant schema and keep going, same "stop and report" principle used
    // for the branch-per-task QA gate itself.
    console.error(error);
    process.exit(1);
  });
}
