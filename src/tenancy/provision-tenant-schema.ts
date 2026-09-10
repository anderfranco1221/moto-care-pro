import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { assertSafeSchemaName, withSchemaParam } from './schema-name.util';

const execFileAsync = promisify(execFile);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * Creates the Postgres schema (if missing) and applies every pending
 * tenant-project migration to it. Called both by scripts/migrate-tenants.ts
 * (operator-run backfill/runbook) and by TenantProvisioningService, so a new
 * tenant's schema exists before its first authenticated request needs it.
 *
 * Idempotent: `CREATE SCHEMA IF NOT EXISTS` and `prisma migrate deploy` both
 * no-op when there is nothing to do, so a failed run is safe to retry (see
 * TenantProvisioningService.ensureProvisioned).
 *
 * Uses the async `execFile`, never `execFileSync`: the Prisma CLI subprocess
 * takes ~1-2s, and a sync spawn would block the whole event loop — every
 * other in-flight request, health check included — for that entire window.
 * With `execFile` only the awaiting caller waits.
 *
 * Shells out to the Prisma CLI rather than using PrismaClientManager's
 * runtime client: only the CLI's classic connection URL honors a `?schema=`
 * override — the adapter-pg driver runtime ignores that query param and
 * needs its own dedicated `schema` option instead (see TenantPrismaService).
 *
 * Lives in src/, not scripts/, so it compiles into dist/ for the running
 * app to import — a path under scripts/ isn't part of `nest build`'s
 * output and would 404 at runtime the same way a stray relative import
 * into prisma/generated/ did in an earlier task.
 */
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

  await execFileAsync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--config', 'prisma.tenant.config.ts'],
    {
      env: {
        ...process.env,
        TENANT_DATABASE_URL: withSchemaParam(baseUrl, schemaName),
      },
    },
  );
}
