import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { MotorcyclesService } from './motorcycles.service';
import { CreateMotorcycleDto } from './dto/create-motorcycle.dto';

describe('MotorcyclesService', () => {
  let service: MotorcyclesService;
  let motorcycle: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    motorcycle = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorcyclesService,
        { provide: TenantPrismaService, useValue: { motorcycle } },
      ],
    }).compile();

    service = module.get(MotorcyclesService);
  });

  const dto: CreateMotorcycleDto = {
    vin: 'JH2PC37G3MK000001',
    brand: 'Honda',
    model: 'CB500',
    year: 2021,
    ownerId: '11111111-1111-4111-8111-111111111111',
  };

  it('create() delegates to prisma.motorcycle.create with the dto', async () => {
    motorcycle.create.mockResolvedValue({ id: 'm1', ...dto });
    await service.create(dto);
    expect(motorcycle.create).toHaveBeenCalledWith({ data: dto });
  });

  it('findAll() returns every motorcycle', async () => {
    motorcycle.findMany.mockResolvedValue([{ id: 'm1' }]);
    await expect(service.findAll()).resolves.toEqual([{ id: 'm1' }]);
  });

  it('findOne() returns the row when found', async () => {
    motorcycle.findUnique.mockResolvedValue({ id: 'm1' });
    await expect(service.findOne('m1')).resolves.toEqual({ id: 'm1' });
    expect(motorcycle.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });

  it('findOne() throws 404 when the row is missing', async () => {
    motorcycle.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update() writes the patch to the matching row', async () => {
    await service.update('m1', { model: 'CB650' });
    expect(motorcycle.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { model: 'CB650' },
    });
  });

  it('remove() deletes by id', async () => {
    await service.remove('m1');
    expect(motorcycle.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });
});
