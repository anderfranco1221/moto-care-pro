import { Test, TestingModule } from '@nestjs/testing';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';

describe('ServicesService', () => {
  let service: ServicesService;
  let prismaService: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: TenantPrismaService, useValue: { service: prismaService } },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  const dto: CreateServiceDto = {
    motorcycleId: '11111111-1111-1111-1111-111111111111',
    description: 'Cambio de aceite',
  };

  it('create() delegates to prisma.service.create with the dto', async () => {
    prismaService.create.mockResolvedValue({ id: 's1', ...dto });

    await expect(service.create(dto)).resolves.toEqual({ id: 's1', ...dto });
    expect(prismaService.create).toHaveBeenCalledWith({ data: dto });
  });

  it('findAll() returns every service', async () => {
    prismaService.findMany.mockResolvedValue([{ id: 's1' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 's1' }]);
    expect(prismaService.findMany).toHaveBeenCalledWith();
  });

  it('findOne() looks up by id', async () => {
    prismaService.findUnique.mockResolvedValue({ id: 's1' });

    await service.findOne('s1');
    expect(prismaService.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
  });

  it('update() writes the patch to the matching row', async () => {
    await service.update('s1', { description: 'Revisión de frenos' });
    expect(prismaService.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { description: 'Revisión de frenos' },
    });
  });

  it('remove() deletes by id', async () => {
    await service.remove('s1');
    expect(prismaService.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
