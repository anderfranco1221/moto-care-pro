import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { MotorcyclesService } from './motorcycles.service';

describe('MotorcyclesService', () => {
  let service: MotorcyclesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MotorcyclesService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<MotorcyclesService>(MotorcyclesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
