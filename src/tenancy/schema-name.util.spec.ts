import { assertSafeSchemaName, withSchemaParam } from './schema-name.util';

describe('assertSafeSchemaName', () => {
  it('accepts a schema name shaped like TenantsService.buildSchemaName output', () => {
    expect(() =>
      assertSafeSchemaName('tenant_taller_los_andes_1b2c3d4e'),
    ).not.toThrow();
  });

  it.each([
    'tenant"; DROP SCHEMA public CASCADE; --',
    'Tenant_A',
    '1tenant',
    'te',
    'tenant a',
    '',
    'a'.repeat(64),
  ])('rejects %p', (unsafe) => {
    expect(() => assertSafeSchemaName(unsafe)).toThrow();
  });
});

describe('withSchemaParam', () => {
  it('sets the schema query param on a connection URL', () => {
    expect(
      withSchemaParam(
        'postgresql://admin:1234@localhost:5433/moto-pro',
        'tenant_a',
      ),
    ).toBe('postgresql://admin:1234@localhost:5433/moto-pro?schema=tenant_a');
  });

  it('overrides an existing schema query param', () => {
    expect(
      withSchemaParam(
        'postgresql://admin:1234@localhost:5433/moto-pro?schema=old',
        'tenant_b',
      ),
    ).toBe('postgresql://admin:1234@localhost:5433/moto-pro?schema=tenant_b');
  });

  it('rejects an unsafe schema name before touching the URL', () => {
    expect(() =>
      withSchemaParam(
        'postgresql://admin:1234@localhost:5433/moto-pro',
        'bad name',
      ),
    ).toThrow();
  });
});
