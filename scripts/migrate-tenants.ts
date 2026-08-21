/**
 * Applies the tenant Prisma project's migrations to a Postgres schema.
 * Prisma has no native "replay this migration history against N schemas"
 * command, so this exists as a standalone runbook step. Run directly:
 *
 *   npm run migrate:tenants                  # all tenants in Tenant table
 *   npm run migrate:tenants -- tenant_abc123 # just one schema
 *
 * `provisionTenantSchema` is also imported at runtime by TenantsService
 * when Fase 2 task 4 wires it into tenant signup, so a new tenant's schema
 * is ready synchronously instead of needing this script run by hand.
 *
 * IMPORTANT: any future change to prisma/tenant/*.prisma (e.g. Fase 3's
 * insumos module) requires re-running this against every existing tenant,
 * not just new ones.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertSafeSchemaName, withSchemaParam } from '../src/tenancy/schema-name.util';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/** Creates the schema (if missing) and applies every pending tenant migration to it. */
export async function provisionTenantSchema(schemaName: string): Promise<void> {
  assertSafeSchemaName(schemaName);
  const baseUrl = requireEnv('TENANT_DATABASE_URL');

  const client = new Client({ connectionString: baseUrl });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  } finally {
    await client.end();
  }

  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--config', 'prisma.tenant.config.ts'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        TENANT_DATABASE_URL: withSchemaParam(baseUrl, schemaName),
      },
    },
  );
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
      console.log(`\n--- Migrating schema "${tenant.schemaName}" (tenant ${tenant.name}) ---`);
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
