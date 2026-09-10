import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * `appointments` module end to end against a real database: a full CRUD
 * cycle, and — since Appointment rows live in the per-tenant schema like
 * Motorcycle — that one tenant never sees another's appointments. Only runs
 * under `npm run test:e2e`.
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
interface AppointmentRow {
  id: string;
  notes: string | null;
  scheduledAt: string;
}

const body = <T>(res: { body: unknown }): T => res.body as T;

describe('Appointments (e2e)', () => {
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

  const appointmentFor = (tenant: Tenant, motorcycleId: string) => ({
    userId: tenant.userId,
    motorcycleId,
    scheduledAt: '2026-10-01T09:00:00.000Z',
  });

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

    alpha = await registerTenant('appt-alpha');
    beta = await registerTenant('appt-beta');
    alphaBikeId = await addMotorcycle(alpha, `APPT-A-${runId}`);
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
    const created = await authed('post', '/appointments', alpha.token)
      .send(appointmentFor(alpha, alphaBikeId))
      .expect(201);
    const { id } = body<AppointmentRow>(created);

    const list = await authed('get', '/appointments', alpha.token).expect(200);
    expect(body<AppointmentRow[]>(list).map((a) => a.id)).toEqual([id]);

    const fetched = await authed(
      'get',
      `/appointments/${id}`,
      alpha.token,
    ).expect(200);
    expect(body<AppointmentRow>(fetched).notes).toBeNull();

    await authed('patch', `/appointments/${id}`, alpha.token)
      .send({ notes: 'Traer repuesto' })
      .expect(200);
    const afterPatch = await authed(
      'get',
      `/appointments/${id}`,
      alpha.token,
    ).expect(200);
    expect(body<AppointmentRow>(afterPatch).notes).toBe('Traer repuesto');

    await authed('delete', `/appointments/${id}`, alpha.token).expect(200);
    const empty = await authed('get', '/appointments', alpha.token).expect(200);
    expect(empty.body).toEqual([]);
  });

  it('rejects a malformed id with 400, not a 500', async () => {
    await authed('get', '/appointments/not-a-uuid', alpha.token).expect(400);
  });

  it('rejects an appointment with a non-UUID motorcycleId', async () => {
    await authed('post', '/appointments', alpha.token)
      .send({
        userId: alpha.userId,
        motorcycleId: 'nope',
        scheduledAt: '2026-10-01T09:00:00.000Z',
      })
      .expect(400);
  });

  it('rejects an appointment with a non-ISO scheduledAt', async () => {
    await authed('post', '/appointments', alpha.token)
      .send({
        userId: alpha.userId,
        motorcycleId: alphaBikeId,
        scheduledAt: 'next tuesday',
      })
      .expect(400);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/appointments').expect(401);
  });

  it('isolates appointments between tenants', async () => {
    const betaBikeId = await addMotorcycle(beta, `APPT-B-${runId}`);
    await authed('post', '/appointments', alpha.token)
      .send({ ...appointmentFor(alpha, alphaBikeId), notes: 'alpha-only' })
      .expect(201);
    await authed('post', '/appointments', beta.token)
      .send({ ...appointmentFor(beta, betaBikeId), notes: 'beta-only' })
      .expect(201);

    const alphaList = await authed('get', '/appointments', alpha.token).expect(
      200,
    );
    const betaList = await authed('get', '/appointments', beta.token).expect(
      200,
    );
    expect(body<AppointmentRow[]>(alphaList).map((a) => a.notes)).toEqual([
      'alpha-only',
    ]);
    expect(body<AppointmentRow[]>(betaList).map((a) => a.notes)).toEqual([
      'beta-only',
    ]);

    const countIn = async (schema: string) => {
      const { rows } = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${schema}"."Appointment"`,
      );
      return Number(rows[0].count);
    };
    expect(await countIn(alpha.schemaName)).toBe(1);
    expect(await countIn(beta.schemaName)).toBe(1);
  });
});
