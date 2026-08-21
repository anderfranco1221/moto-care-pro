import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: { tenant: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { tenant: { create: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('genera un schemaName único a partir del nombre del taller', async () => {
      prisma.tenant.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: '1', createdAt: new Date(), ...data }),
      );

      const result = await service.create('Taller Los Andes S.A.');

      expect(prisma.tenant.create).toHaveBeenCalledTimes(1);
      expect(result.schemaName).toMatch(
        /^tenant_taller_los_andes_s_a_[0-9a-f]{8}$/,
      );
    });

    it('usa un fallback cuando el nombre no aporta caracteres válidos', async () => {
      prisma.tenant.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: '1', createdAt: new Date(), ...data }),
      );

      const result = await service.create('!!!');

      expect(result.schemaName).toMatch(/^tenant_workshop_[0-9a-f]{8}$/);
    });
  });
});
