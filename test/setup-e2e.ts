/**
 * Environment defaults for the e2e run. CI (and a local `.env`) can override
 * any of these; unset, they point at the docker-compose Postgres, so
 * `docker compose up -d db` is enough to run `npm run test:e2e` locally.
 *
 * Only `test/jest-e2e.json` loads this file — the unit `jest` run never does.
 */
const DEFAULT_DATABASE_URL = 'postgresql://admin:1234@localhost:5433/moto-pro';

process.env.DATABASE_URL ||= DEFAULT_DATABASE_URL;
// Same database as the shared project here; isolation is per-schema, and each
// tenant client pins its own schema via adapter-pg (see PrismaClientManager).
process.env.TENANT_DATABASE_URL ||= process.env.DATABASE_URL;
process.env.JWT_SECRET ||= 'e2e-secret';
process.env.JWT_EXPIRES_IN ||= '3600';
