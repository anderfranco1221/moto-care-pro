// Second Prisma "project" config for the per-tenant schema (see prisma/tenant/).
// Applied against N tenant schemas via scripts/migrate-tenants.ts, never against `public`.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/tenant',
  migrations: {
    path: 'prisma/tenant/migrations',
  },
  datasource: {
    // Not DATABASE_URL: this project's migrations are meant to be replayed
    // against per-tenant schemas, never against the shared project's `public`.
    url: process.env['TENANT_DATABASE_URL'] ?? process.env['DATABASE_URL'],
  },
});
