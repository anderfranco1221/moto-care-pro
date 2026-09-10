import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * `supplies` module (workshop inventory) end to end against a real
 * database: the CRUD cycle, the stock-movement endpoint keeping
 * Supply.stock in sync with the movement history, the negative-stock
 * guard, and cross-tenant isolation. Only runs under `npm run test:e2e`.
 */

const REPO_ROOT = join(__dirname, '..');
const HOOK_TIMEOUT_MS = 120_000;

interface Tenant {
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
interface SupplyRow {
  id: string;
  stock: number;
  sku: string;
}

const body = <T>(res: { body: unknown }): T => res.body as T;

describe('Supplies (e2e)', () => {
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
    const { tenantId } = body<RegisterResponse>(registration);
    const { rows } = await db.query<{ schemaName: string }>(
      'SELECT "schemaName" FROM public."Tenant" WHERE id = $1',
      [tenantId],
    );

    const tenant: Tenant = {
      tenantId,
      schemaName: rows[0].schemaName,
      token: body<LoginResponse>(login).access_token,
    };
    tenants.push(tenant);
    return tenant;
  }

  const supply = (sku: string, stock?: number) => ({
    name: 'Aceite 10W40',
    sku,
    unit: 'L',
    ...(stock === undefined ? {} : { stock }),
  });

  let alpha: Tenant;
  let beta: Tenant;

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

    alpha = await registerTenant('sup-alpha');
    beta = await registerTenant('sup-beta');
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
    const created = await authed('post', '/supplies', alpha.token)
      .send(supply(`OIL-${runId}`, 10))
      .expect(201);
    const { id } = body<SupplyRow>(created);

    const fetched = await authed('get', `/supplies/${id}`, alpha.token).expect(
      200,
    );
    expect(body<SupplyRow>(fetched).stock).toBe(10);

    await authed('patch', `/supplies/${id}`, alpha.token)
      .send({ unit: 'ml' })
      .expect(200);

    await authed('delete', `/supplies/${id}`, alpha.token).expect(200);
    const empty = await authed('get', '/supplies', alpha.token).expect(200);
    expect(empty.body).toEqual([]);
  });

  it('rejects a stock field on PATCH (only movements change stock)', async () => {
    const created = await authed('post', '/supplies', alpha.token)
      .send(supply(`LOCK-${runId}`, 5))
      .expect(201);
    const { id } = body<SupplyRow>(created);

    await authed('patch', `/supplies/${id}`, alpha.token)
      .send({ stock: 999 })
      .expect(400);

    await authed('delete', `/supplies/${id}`, alpha.token).expect(200);
  });

  it('keeps stock in sync with movements and records the history', async () => {
    const created = await authed('post', '/supplies', alpha.token)
      .send(supply(`MOV-${runId}`))
      .expect(201);
    const { id } = body<SupplyRow>(created);

    await authed('post', `/supplies/${id}/movements`, alpha.token)
      .send({ type: 'IN', quantity: 20, reason: 'compra' })
      .expect(201);
    await authed('post', `/supplies/${id}/movements`, alpha.token)
      .send({ type: 'OUT', quantity: 8, reason: 'servicio' })
      .expect(201);

    const after = await authed('get', `/supplies/${id}`, alpha.token).expect(
      200,
    );
    expect(body<SupplyRow>(after).stock).toBe(12);

    const history = await authed(
      'get',
      `/supplies/${id}/movements`,
      alpha.token,
    ).expect(200);
    expect(
      body<{ type: string; quantity: number }[]>(history).map(
        (m) => `${m.type}:${m.quantity}`,
      ),
    ).toEqual(['OUT:8', 'IN:20']);

    await authed('delete', `/supplies/${id}`, alpha.token).expect(200);
  });

  it('refuses an OUT movement that would take stock below zero (409)', async () => {
    const created = await authed('post', '/supplies', alpha.token)
      .send(supply(`NEG-${runId}`, 3))
      .expect(201);
    const { id } = body<SupplyRow>(created);

    await authed('post', `/supplies/${id}/movements`, alpha.token)
      .send({ type: 'OUT', quantity: 10 })
      .expect(409);

    const after = await authed('get', `/supplies/${id}`, alpha.token).expect(
      200,
    );
    expect(body<SupplyRow>(after).stock).toBe(3);

    await authed('delete', `/supplies/${id}`, alpha.token).expect(200);
  });

  it('returns 404 for a movement on a missing supply', async () => {
    await authed(
      'post',
      '/supplies/11111111-1111-1111-1111-111111111111/movements',
      alpha.token,
    )
      .send({ type: 'IN', quantity: 1 })
      .expect(404);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/supplies').expect(401);
  });

  it('isolates supplies between tenants', async () => {
    await authed('post', '/supplies', alpha.token)
      .send(supply(`ISO-A-${runId}`))
      .expect(201);
    await authed('post', '/supplies', beta.token)
      .send(supply(`ISO-B-${runId}`))
      .expect(201);

    const alphaList = await authed('get', '/supplies', alpha.token).expect(200);
    const betaList = await authed('get', '/supplies', beta.token).expect(200);
    expect(body<SupplyRow[]>(alphaList).map((s) => s.sku)).toEqual([
      `ISO-A-${runId}`,
    ]);
    expect(body<SupplyRow[]>(betaList).map((s) => s.sku)).toEqual([
      `ISO-B-${runId}`,
    ]);

    const countIn = async (schema: string) => {
      const { rows } = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${schema}"."Supply"`,
      );
      return Number(rows[0].count);
    };
    expect(await countIn(alpha.schemaName)).toBe(1);
    expect(await countIn(beta.schemaName)).toBe(1);
  });
});
