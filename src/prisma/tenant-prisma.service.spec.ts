import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientManager } from '../tenancy/prisma-client-manager.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { TenantPrismaService } from './tenant-prisma.service';

describe('TenantPrismaService', () => {
  let service: TenantPrismaService;
  let clientManager: { getClient: jest.Mock };
  let tenantContext: { getSchemaName: jest.Mock };
  let fakeMotorcycleDelegate: { findMany: jest.Mock };

  beforeEach(async () => {
    fakeMotorcycleDelegate = {
      findMany: jest.fn().mockResolvedValue(['a moto']),
    };
    clientManager = {
      getClient: jest
        .fn()
        .mockResolvedValue({ motorcycle: fakeMotorcycleDelegate }),
    };
    tenantContext = { getSchemaName: jest.fn().mockReturnValue('tenant_a') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantPrismaService,
        { provide: PrismaClientManager, useValue: clientManager },
        { provide: TenantContextService, useValue: tenantContext },
      ],
    }).compile();

    service = module.get<TenantPrismaService>(TenantPrismaService);
  });

  it('resolves the current tenant schema and delegates the call', async () => {
    const result = await (
      service as unknown as {
        motorcycle: { findMany: (...a: unknown[]) => unknown };
      }
    ).motorcycle.findMany({ where: { id: '1' } });

    expect(tenantContext.getSchemaName).toHaveBeenCalledTimes(1);
    expect(clientManager.getClient).toHaveBeenCalledWith('tenant_a');
    expect(fakeMotorcycleDelegate.findMany).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(result).toEqual(['a moto']);
  });

  it('re-resolves the schema on every call, not just the first', async () => {
    tenantContext.getSchemaName
      .mockReturnValueOnce('tenant_a')
      .mockReturnValueOnce('tenant_b');
    const proxied = service as unknown as {
      motorcycle: { findMany: (...a: unknown[]) => unknown };
    };

    await proxied.motorcycle.findMany();
    await proxied.motorcycle.findMany();

    expect(clientManager.getClient).toHaveBeenNthCalledWith(1, 'tenant_a');
    expect(clientManager.getClient).toHaveBeenNthCalledWith(2, 'tenant_b');
  });

  it('propagates a missing tenant context as a rejected promise', async () => {
    tenantContext.getSchemaName.mockImplementation(() => {
      throw new Error('no tenant set');
    });
    const proxied = service as unknown as {
      motorcycle: { findMany: (...a: unknown[]) => unknown };
    };

    await expect(proxied.motorcycle.findMany()).rejects.toThrow(
      'no tenant set',
    );
    expect(clientManager.getClient).not.toHaveBeenCalled();
  });
});
