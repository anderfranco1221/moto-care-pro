import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType, Prisma } from '@prisma-tenant/client';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';

const p2025 = new Prisma.PrismaClientKnownRequestError('No record was found', {
  code: 'P2025',
  clientVersion: 'test',
});

describe('SuppliesService', () => {
  let service: SuppliesService;
  let supply: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let stockMovement: { findMany: jest.Mock };

  beforeEach(async () => {
    supply = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    stockMovement = { findMany: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: TenantPrismaService, useValue: { supply, stockMovement } },
      ],
    }).compile();

    service = module.get(SuppliesService);
  });

  const dto: CreateSupplyDto = {
    name: 'Aceite 10W40',
    sku: 'OIL-1040',
    unit: 'L',
  };

  it('create() delegates to prisma.supply.create with the dto', async () => {
    supply.create.mockResolvedValue({ id: 's1', stock: 0, ...dto });
    await service.create(dto);
    expect(supply.create).toHaveBeenCalledWith({ data: dto });
  });

  it('listMovements() returns the history newest first', async () => {
    await service.listMovements('s1');
    expect(stockMovement.findMany).toHaveBeenCalledWith({
      where: { supplyId: 's1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('registerMovement() IN increments stock and records the movement', async () => {
    supply.update.mockResolvedValue({ id: 's1', stock: 15 });

    await service.registerMovement('s1', {
      type: MovementType.IN,
      quantity: 15,
      reason: 'compra',
    });

    expect(supply.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        stock: { increment: 15 },
        movements: {
          create: { type: MovementType.IN, quantity: 15, reason: 'compra' },
        },
      },
    });
  });

  it('registerMovement() OUT guards the decrement with a conditional where', async () => {
    supply.update.mockResolvedValue({ id: 's1', stock: 5 });

    await service.registerMovement('s1', {
      type: MovementType.OUT,
      quantity: 10,
    });

    expect(supply.update).toHaveBeenCalledWith({
      where: { id: 's1', stock: { gte: 10 } },
      data: {
        stock: { increment: -10 },
        movements: {
          create: { type: MovementType.OUT, quantity: 10, reason: undefined },
        },
      },
    });
  });

  it('registerMovement() throws 404 when the supply does not exist', async () => {
    supply.update.mockRejectedValue(p2025);
    supply.findUnique.mockResolvedValue(null);

    await expect(
      service.registerMovement('missing', {
        type: MovementType.OUT,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registerMovement() throws 409 when stock would go negative', async () => {
    supply.update.mockRejectedValue(p2025);
    supply.findUnique.mockResolvedValue({ id: 's1', stock: 3 });

    await expect(
      service.registerMovement('s1', { type: MovementType.OUT, quantity: 10 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
