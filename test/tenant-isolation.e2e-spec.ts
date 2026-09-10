import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Fase 2's closing check: two tenants, the same data, no leaks between their
 * Postgres schemas. Exercises the whole per-tenant routing chain end to end
 * against a real database — registration provisioning the schema, the JWT
 * claim carrying it, the CLS context, and the TenantPrismaService Proxy
 * resolving a per-schema client on every call.
 *
 * Needs a running Postgres (see test/setup-e2e.ts for the connection). The
 * unit `jest` run excludes *.e2e-spec.ts — this only runs under
 * `npm run test:e2e`.
 */

const REPO_ROOT = join(__dirname, '..');
const HOOK_TIMEOUT_MS = 120_000;

interface RegisterResponse {
  id: string;
  tenantId: string;
}
interface LoginResponse {
  access_token: string;
}
interface MotorcycleResponse {
  id: string;
  vin: string;
}

/** Applies the shared-project migrations to `public`. Idempotent. */
function migrateSharedSchema(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    env: process.env,
  });
}

interface Tenant {
  userId: string;
  tenantId: string;
  schemaName: string;
  token: string;
}

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let db: Client;
  const runId = Date.now().toString(36);
  const tenants: Tenant[] = [];

  const bike = (vin: string) => ({
    vin,
    brand: 'Honda',
    model: 'CB500',
    year: 2021,
  });

  const httpServer = () => app.getHttpServer();

  const listMotorcycles = (token: string) =>
    request(httpServer())
      .get('/motorcycles')
      .set('Authorization', `Bearer ${token}`);

  const addMotorcycle = (token: string, ownerId: string, vin: string) =>
    request(httpServer())
      .post('/motorcycles')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...bike(vin), ownerId });

  const vinsOf = (body: unknown) =>
    (body as MotorcycleResponse[]).map((m) => m.vin).sort();

  async function registerTenant(label: string): Promise<Tenant> {
    const email = `${label}.${runId}@e2e.test`;
    const password = 'e2e-password';
    const workshopName = `${label} ${runId}`;

    const registration = await request(httpServer())
      .post('/auth/register')
      .send({ email, password, name: label, tenantName: workshopName })
      .expect(201);
    const { id: userId, tenantId } = registration.body as RegisterResponse;

    const login = await request(httpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const { access_token: token } = login.body as LoginResponse;

    const { rows } = await db.query<{ schemaName: string }>(
      'SELECT "schemaName" FROM public."Tenant" WHERE id = $1',
      [tenantId],
    );

    const tenant: Tenant = {
      userId,
      tenantId,
      schemaName: rows[0].schemaName,
      token,
    };
    tenants.push(tenant);
    return tenant;
  }

  let alpha: Tenant;
  let beta: Tenant;

  beforeAll(async () => {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await db.connect();
    } catch (cause) {
      throw new Error(
        `Cannot reach Postgres at ${process.env.DATABASE_URL}. ` +
          'Start it with `docker compose up -d db` (or set DATABASE_URL).',
        { cause },
      );
    }

    migrateSharedSchema();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts: the TestingModule does not apply main.ts's bootstrap.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    // listen() rather than just init(): supertest then drives a real
    // listening server over real sockets — matching production, and keeping
    // each request in its own AsyncLocalStorage (CLS) context under load.
    await app.listen(0);

    alpha = await registerTenant('alpha');
    beta = await registerTenant('beta');
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    for (const tenant of tenants) {
      await db.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
    }
    if (tenants.length > 0) {
      const ids = tenants.map((t) => t.tenantId);
      await db.query(
        'DELETE FROM public."User" WHERE "tenantId" = ANY($1::text[])',
        [ids],
      );
      await db.query('DELETE FROM public."Tenant" WHERE id = ANY($1::text[])', [
        ids,
      ]);
    }
    await app?.close();
    await db?.end();
  }, HOOK_TIMEOUT_MS);

  it('provisions a separate Postgres schema per tenant at registration', async () => {
    expect(alpha.schemaName).not.toEqual(beta.schemaName);

    const { rows } = await db.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name = ANY($1::text[])`,
      [[alpha.schemaName, beta.schemaName]],
    );
    expect(rows.map((r) => r.schema_name).sort()).toEqual(
      [alpha.schemaName, beta.schemaName].sort(),
    );
  });

  it('accepts the same VIN under each tenant without a unique-constraint clash', async () => {
    await addMotorcycle(alpha.token, alpha.userId, 'SHARED-VIN-0001').expect(
      201,
    );
    await addMotorcycle(beta.token, beta.userId, 'SHARED-VIN-0001').expect(201);

    // A second bike for alpha only, so the two tenants' row sets differ.
    await addMotorcycle(alpha.token, alpha.userId, 'ALPHA-ONLY-0002').expect(
      201,
    );
  });

  it('still enforces the VIN unique index within a single tenant schema', async () => {
    const res = await addMotorcycle(
      alpha.token,
      alpha.userId,
      'SHARED-VIN-0001',
    );
    // No Prisma exception filter is wired, so P2002 surfaces as a 500 — the
    // point is that the duplicate is rejected, not silently written.
    expect(res.status).not.toBe(201);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns only the requesting tenant’s motorcycles', async () => {
    const alphaList = await listMotorcycles(alpha.token).expect(200);
    const betaList = await listMotorcycles(beta.token).expect(200);

    expect(vinsOf(alphaList.body)).toEqual([
      'ALPHA-ONLY-0002',
      'SHARED-VIN-0001',
    ]);
    expect(vinsOf(betaList.body)).toEqual(['SHARED-VIN-0001']);
  });

  it('rejects unauthenticated access to a tenant-scoped route', async () => {
    await request(httpServer()).get('/motorcycles').expect(401);
  });

  it('writes each tenant’s rows only into its own schema, never into public', async () => {
    const rowCount = async (schema: string) => {
      const { rows } = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${schema}"."Motorcycle"`,
      );
      return Number(rows[0].count);
    };

    expect(await rowCount(alpha.schemaName)).toBe(2);
    expect(await rowCount(beta.schemaName)).toBe(1);

    const { rows } = await db.query<{ table: string | null }>(
      `SELECT to_regclass('public."Motorcycle"')::text AS "table"`,
    );
    expect(rows[0].table).toBeNull();
  });

  it('keeps tenant context correct under interleaved concurrent requests', async () => {
    const expected: Record<string, string[]> = {
      [alpha.token]: ['ALPHA-ONLY-0002', 'SHARED-VIN-0001'],
      [beta.token]: ['SHARED-VIN-0001'],
    };

    const checks = Array.from({ length: 30 }, (_, i) => {
      const token = i % 2 === 0 ? alpha.token : beta.token;
      return listMotorcycles(token)
        .expect(200)
        .then((res) => {
          expect(vinsOf(res.body)).toEqual(expected[token]);
        });
    });

    await Promise.all(checks);
  });
});
