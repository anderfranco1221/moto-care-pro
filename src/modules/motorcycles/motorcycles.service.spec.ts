import { Test, TestingModule } from '@nestjs/testing';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { MotorcyclesService } from './motorcycles.service';

describe('MotorcyclesService', () => {
  let service: MotorcyclesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorcyclesService,
        { provide: TenantPrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<MotorcyclesService>(MotorcyclesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
