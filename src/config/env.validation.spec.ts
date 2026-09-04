import 'reflect-metadata';
import { validateEnv } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://admin:1234@localhost:5433/moto-pro',
  TENANT_DATABASE_URL: 'postgresql://admin:1234@localhost:5433/moto-pro',
  JWT_SECRET: 'a-long-random-secret',
  JWT_EXPIRES_IN: '86400',
  PORT: '3000',
};

describe('validateEnv', () => {
  it('accepts a fully populated environment and coerces numerics', () => {
    const result = validateEnv({ ...validEnv });

    expect(result.PORT).toBe(3000);
    expect(result.JWT_EXPIRES_IN).toBe(86400);
  });

  it('throws when a required var is missing', () => {
    const { TENANT_DATABASE_URL: _omit, ...rest } = validEnv;

    expect(() => validateEnv(rest)).toThrow(/TENANT_DATABASE_URL/);
  });

  it('throws when PORT is not a valid number', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'not-a-port' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('reports every problem at once, not just the first', () => {
    expect(() => validateEnv({})).toThrow(
      /JWT_SECRET.*DATABASE_URL|DATABASE_URL.*JWT_SECRET/s,
    );
  });
});
