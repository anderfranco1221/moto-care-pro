import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Rate limiting is on for real here (setup-e2e disables it for every other
 * suite). Checks the tight per-minute cap on the unauthenticated auth
 * routes. Only runs under `npm run test:e2e`.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  const previous = process.env.THROTTLE_DISABLED;

  beforeAll(async () => {
    delete process.env.THROTTLE_DISABLED;

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
  }, 60_000);

  afterAll(async () => {
    process.env.THROTTLE_DISABLED = previous;
    await app?.close();
  });

  it('429s after 5 login attempts from the same client in a minute', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@e2e.test', password: 'wrong-password' });

    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await attempt()).status);
    }

    // First 5 get through to the handler (401, bad credentials); the rest
    // are rejected by the throttler before reaching it.
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
  });
});
