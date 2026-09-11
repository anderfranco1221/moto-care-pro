import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * `motorcycles` module end to end against a real database: the full CRUD
 * cycle and the not-found / malformed-id paths, per tenant. Cross-tenant
 * isolation for this model is covered by tenant-isolation.e2e-spec.ts.
 * Only runs under `npm run test:e2e`.
 */

const REPO_ROOT = join(__dirname, '..');
const HOOK_TIMEOUT_MS = 120_000;

interface Tenant {
  userId: string;
  tenantId: string;
  schemaName: string;
  token: string;
}

const body = <T>(res: { body: unknown }): T => res.body as T;

describe('Motorcycles (e2e)', () => {
  let app: INestApplication<App>;
  let db: Client;
  const runId = Date.now().toString(36);
  const tenants: Tenant[] = [];

  const authed = (
    method: 'get' | 'post' | 'patch' | 'delete',
    url: string,
    token: string,
  ) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token}`);

  async function registerTenant(label: string): Promise<Tenant> {
    const email = `${label}.${runId}@e2e.test`;
    const password = 'e2e-password';
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, tenantName: `${label} ${runId}` })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const { id: userId, tenantId } = body<{ id: string; tenantId: string }>(
      registration,
    );
    const { rows } = await db.query<{ schemaName: string }>(
      'SELECT "schemaName" FROM public."Tenant" WHERE id = $1',
      [tenantId],
    );
    const tenant: Tenant = {
      userId,
      tenantId,
      schemaName: rows[0].schemaName,
      token: body<{ access_token: string }>(login).access_token,
    };
    tenants.push(tenant);
    return tenant;
  }

  const bike = (vin: string) => ({
    vin,
    brand: 'Honda',
    model: 'CB500',
    year: 2021,
  });

  let alpha: Tenant;

  beforeAll(async () => {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      env: process.env,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0);

    alpha = await registerTenant('moto-alpha');
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

  it('runs a full create/read/update/delete cycle', async () => {
    const created = await authed('post', '/motorcycles', alpha.token)
      .send({ ...bike(`MOTO-${runId}`), ownerId: alpha.userId })
      .expect(201);
    const { id } = body<{ id: string }>(created);

    const fetched = await authed(
      'get',
      `/motorcycles/${id}`,
      alpha.token,
    ).expect(200);
    expect(body<{ model: string }>(fetched).model).toBe('CB500');

    await authed('patch', `/motorcycles/${id}`, alpha.token)
      .send({ model: 'CB650' })
      .expect(200);
    const afterPatch = await authed(
      'get',
      `/motorcycles/${id}`,
      alpha.token,
    ).expect(200);
    expect(body<{ model: string }>(afterPatch).model).toBe('CB650');

    await authed('delete', `/motorcycles/${id}`, alpha.token).expect(200);
    await authed('get', `/motorcycles/${id}`, alpha.token).expect(404);
  });

  it('404s a motorcycle that does not exist', async () => {
    await authed(
      'get',
      '/motorcycles/11111111-1111-4111-8111-111111111111',
      alpha.token,
    ).expect(404);
  });

  it('rejects a malformed id with 400, not a 500', async () => {
    await authed('get', '/motorcycles/not-a-uuid', alpha.token).expect(400);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/motorcycles').expect(401);
  });
});
