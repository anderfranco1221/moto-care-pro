import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * `services` module end to end against a real database: a full CRUD cycle,
 * and — since Service rows live in the per-tenant schema like Motorcycle —
 * that one tenant never sees another's services. Only runs under
 * `npm run test:e2e`.
 */

const REPO_ROOT = join(__dirname, '..');
const HOOK_TIMEOUT_MS = 120_000;

interface Tenant {
  userId: string;
  tenantId: string;
  schemaName: string;
  token: string;
}
interface RegisterResponse {
  id: string;
  tenantId: string;
}
interface LoginResponse {
  access_token: string;
}
interface ServiceRow {
  id: string;
  description: string;
  mechanic: string | null;
}

const body = <T>(res: { body: unknown }): T => res.body as T;

describe('Services (e2e)', () => {
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
    const { id: userId, tenantId } = body<RegisterResponse>(registration);
    const { rows } = await db.query<{ schemaName: string }>(
      'SELECT "schemaName" FROM public."Tenant" WHERE id = $1',
      [tenantId],
    );

    const tenant: Tenant = {
      userId,
      tenantId,
      schemaName: rows[0].schemaName,
      token: body<LoginResponse>(login).access_token,
    };
    tenants.push(tenant);
    return tenant;
  }

  async function addMotorcycle(tenant: Tenant, vin: string): Promise<string> {
    const res = await authed('post', '/motorcycles', tenant.token)
      .send({
        vin,
        brand: 'Honda',
        model: 'CB500',
        year: 2021,
        ownerId: tenant.userId,
      })
      .expect(201);
    return body<{ id: string }>(res).id;
  }

  let alpha: Tenant;
  let beta: Tenant;
  let alphaBikeId: string;

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

    alpha = await registerTenant('svc-alpha');
    beta = await registerTenant('svc-beta');
    alphaBikeId = await addMotorcycle(alpha, `SVC-A-${runId}`);
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
    const created = await authed('post', '/services', alpha.token)
      .send({ motorcycleId: alphaBikeId, description: 'Cambio de aceite' })
      .expect(201);
    const { id } = body<ServiceRow>(created);

    const list = await authed('get', '/services', alpha.token).expect(200);
    expect(body<ServiceRow[]>(list).map((s) => s.id)).toEqual([id]);

    const fetched = await authed('get', `/services/${id}`, alpha.token).expect(
      200,
    );
    expect(body<ServiceRow>(fetched).description).toBe('Cambio de aceite');

    await authed('patch', `/services/${id}`, alpha.token)
      .send({ mechanic: 'Ana' })
      .expect(200);
    const afterPatch = await authed(
      'get',
      `/services/${id}`,
      alpha.token,
    ).expect(200);
    expect(body<ServiceRow>(afterPatch).mechanic).toBe('Ana');

    await authed('delete', `/services/${id}`, alpha.token).expect(200);
    const empty = await authed('get', '/services', alpha.token).expect(200);
    expect(empty.body).toEqual([]);
  });

  it('rejects a malformed id with 400, not a 500', async () => {
    await authed('get', '/services/not-a-uuid', alpha.token).expect(400);
  });

  it('rejects a service for a non-UUID motorcycleId', async () => {
    await authed('post', '/services', alpha.token)
      .send({ motorcycleId: 'nope', description: 'x' })
      .expect(400);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/services').expect(401);
  });

  it('404s a service for a motorcycle that does not exist', async () => {
    await authed('post', '/services', alpha.token)
      .send({
        motorcycleId: '11111111-1111-4111-8111-111111111111',
        description: 'x',
      })
      .expect(404);
  });

  it('isolates services between tenants', async () => {
    const betaBikeId = await addMotorcycle(beta, `SVC-B-${runId}`);
    await authed('post', '/services', alpha.token)
      .send({ motorcycleId: alphaBikeId, description: 'alpha-only service' })
      .expect(201);
    await authed('post', '/services', beta.token)
      .send({ motorcycleId: betaBikeId, description: 'beta-only service' })
      .expect(201);

    const alphaList = await authed('get', '/services', alpha.token).expect(200);
    const betaList = await authed('get', '/services', beta.token).expect(200);
    expect(body<ServiceRow[]>(alphaList).map((s) => s.description)).toEqual([
      'alpha-only service',
    ]);
    expect(body<ServiceRow[]>(betaList).map((s) => s.description)).toEqual([
      'beta-only service',
    ]);

    const countIn = async (schema: string) => {
      const { rows } = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${schema}"."Service"`,
      );
      return Number(rows[0].count);
    };
    expect(await countIn(alpha.schemaName)).toBe(1);
    expect(await countIn(beta.schemaName)).toBe(1);
  });

  it('consumes supplies from stock when a service is created with them', async () => {
    const supplyRes = await authed('post', '/supplies', alpha.token)
      .send({ name: 'Filtro', sku: `FIL-${runId}`, unit: 'u', stock: 5 })
      .expect(201);
    const supplyId = body<{ id: string }>(supplyRes).id;

    await authed('post', '/services', alpha.token)
      .send({
        motorcycleId: alphaBikeId,
        description: 'Cambio de filtro',
        supplies: [{ supplyId, quantity: 2 }],
      })
      .expect(201);

    const supply = await authed(
      'get',
      `/supplies/${supplyId}`,
      alpha.token,
    ).expect(200);
    expect(body<{ stock: number }>(supply).stock).toBe(3);

    const movements = await authed(
      'get',
      `/supplies/${supplyId}/movements`,
      alpha.token,
    ).expect(200);
    expect(body<{ type: string; quantity: number }[]>(movements)).toEqual([
      expect.objectContaining({ type: 'OUT', quantity: 2 }),
    ]);
  });

  it('rolls back the service when a supply line is under-stocked (409)', async () => {
    const supplyRes = await authed('post', '/supplies', alpha.token)
      .send({ name: 'Bujía', sku: `BUJ-${runId}`, unit: 'u', stock: 1 })
      .expect(201);
    const supplyId = body<{ id: string }>(supplyRes).id;

    const before = await authed('get', '/services', alpha.token).expect(200);

    await authed('post', '/services', alpha.token)
      .send({
        motorcycleId: alphaBikeId,
        description: 'Cambio de bujías',
        supplies: [{ supplyId, quantity: 4 }],
      })
      .expect(409);

    const after = await authed('get', '/services', alpha.token).expect(200);
    expect(body<unknown[]>(after)).toHaveLength(body<unknown[]>(before).length);

    const supply = await authed(
      'get',
      `/supplies/${supplyId}`,
      alpha.token,
    ).expect(200);
    expect(body<{ stock: number }>(supply).stock).toBe(1);
  });
});
