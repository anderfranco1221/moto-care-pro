import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { provisionTenantSchema } from '../../tenancy/provision-tenant-schema';
import { TenantProvisioningService } from './tenant-provisioning.service';

jest.mock('../../tenancy/provision-tenant-schema', () => ({
  provisionTenantSchema: jest.fn(),
}));

const provisionMock = provisionTenantSchema as jest.MockedFunction<
  typeof provisionTenantSchema
>;

describe('TenantProvisioningService', () => {
  let service: TenantProvisioningService;
  let prisma: { tenant: { update: jest.Mock } };

  const pendingTenant = {
    id: 'tenant-1',
    schemaName: 'tenant_taller_abcd1234',
    provisioningStatus: 'PENDING' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = { tenant: { update: jest.fn().mockResolvedValue(undefined) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantProvisioningService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TenantProvisioningService);
  });

  it('is a no-op for an already READY tenant', async () => {
    const status = await service.ensureProvisioned({
      ...pendingTenant,
      provisioningStatus: 'READY',
    });

    expect(status).toBe('READY');
    expect(provisionMock).not.toHaveBeenCalled();
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('provisions the schema and marks the tenant READY', async () => {
    provisionMock.mockResolvedValue(undefined);

    const status = await service.ensureProvisioned(pendingTenant);

    expect(status).toBe('READY');
    expect(provisionMock).toHaveBeenCalledWith('tenant_taller_abcd1234');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { provisioningStatus: 'READY' },
    });
  });

  it('marks the tenant FAILED and returns FAILED when provisioning throws', async () => {
    provisionMock.mockRejectedValue(new Error('migrate deploy failed'));

    const status = await service.ensureProvisioned(pendingTenant);

    expect(status).toBe('FAILED');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { provisioningStatus: 'FAILED' },
    });
  });

  it('still resolves when the FAILED status write also fails', async () => {
    provisionMock.mockRejectedValue(new Error('migrate deploy failed'));
    prisma.tenant.update.mockRejectedValue(new Error('PG down'));

    await expect(service.ensureProvisioned(pendingTenant)).resolves.toBe(
      'FAILED',
    );
  });
});
