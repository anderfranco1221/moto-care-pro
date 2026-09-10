import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma-tenant/client';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';

describe('ServicesService', () => {
  let service: ServicesService;
  let serviceDelegate: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let motorcycle: { findUnique: jest.Mock };
  // A transaction client whose calls we can assert on; $transaction just
  // runs the callback with it.
  let tx: {
    service: { create: jest.Mock; findUnique: jest.Mock };
    supply: { updateMany: jest.Mock; findUnique: jest.Mock };
    stockMovement: { create: jest.Mock };
  };

  beforeEach(async () => {
    serviceDelegate = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    motorcycle = { findUnique: jest.fn().mockResolvedValue({ id: 'm1' }) };
    tx = {
      service: {
        create: jest.fn().mockResolvedValue({ id: 's1' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's1', stockMovements: [] }),
      },
      supply: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      stockMovement: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: TenantPrismaService,
          useValue: {
            service: serviceDelegate,
            motorcycle,
            $transaction: (cb: (client: typeof tx) => unknown) => cb(tx),
          },
        },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  const dto: CreateServiceDto = {
    motorcycleId: '11111111-1111-1111-1111-111111111111',
    description: 'Cambio de aceite',
  };

  it('create() checks the motorcycle then delegates a plain create', async () => {
    serviceDelegate.create.mockResolvedValue({ id: 's1', ...dto });

    await service.create(dto);

    expect(motorcycle.findUnique).toHaveBeenCalledWith({
      where: { id: dto.motorcycleId },
    });
    expect(serviceDelegate.create).toHaveBeenCalledWith({ data: dto });
  });

  it('create() throws 404 when the motorcycle does not exist', async () => {
    motorcycle.findUnique.mockResolvedValue(null);

    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(serviceDelegate.create).not.toHaveBeenCalled();
  });

  it('create() with supplies deducts stock and records an OUT movement', async () => {
    await service.create({
      ...dto,
      supplies: [{ supplyId: 'sup1', quantity: 3 }],
    });

    expect(tx.supply.updateMany).toHaveBeenCalledWith({
      where: { id: 'sup1', stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        supplyId: 'sup1',
        serviceId: 's1',
        type: MovementType.OUT,
        quantity: 3,
        reason: 'service:s1',
      },
    });
  });

  it('create() with an under-stocked supply rejects with 409', async () => {
    tx.supply.updateMany.mockResolvedValue({ count: 0 });
    tx.supply.findUnique.mockResolvedValue({ id: 'sup1', stock: 1 });

    await expect(
      service.create({ ...dto, supplies: [{ supplyId: 'sup1', quantity: 3 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne() throws 404 when the row is missing', async () => {
    serviceDelegate.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update() writes the patch to the matching row', async () => {
    await service.update('s1', { description: 'Revisión de frenos' });
    expect(serviceDelegate.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { description: 'Revisión de frenos' },
    });
  });

  it('remove() deletes by id', async () => {
    await service.remove('s1');
    expect(serviceDelegate.delete).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
  });
});
