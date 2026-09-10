import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma-tenant/client';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';

describe('SuppliesController', () => {
  let controller: SuppliesController;
  let suppliesService: Record<keyof SuppliesService, jest.Mock>;

  beforeEach(async () => {
    suppliesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      listMovements: jest.fn(),
      registerMovement: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliesController],
      providers: [{ provide: SuppliesService, useValue: suppliesService }],
    }).compile();

    controller = module.get(SuppliesController);
  });

  const dto: CreateSupplyDto = { name: 'Aceite', sku: 'OIL-1', unit: 'L' };

  it('POST / forwards the body to supplies.create', () => {
    void controller.create(dto);
    expect(suppliesService.create).toHaveBeenCalledWith(dto);
  });

  it('GET / forwards to supplies.findAll', () => {
    void controller.findAll();
    expect(suppliesService.findAll).toHaveBeenCalledWith();
  });

  it('GET /:id forwards the id to supplies.findOne', () => {
    void controller.findOne('s1');
    expect(suppliesService.findOne).toHaveBeenCalledWith('s1');
  });

  it('PATCH /:id forwards id and body to supplies.update', () => {
    void controller.update('s1', { unit: 'ml' });
    expect(suppliesService.update).toHaveBeenCalledWith('s1', { unit: 'ml' });
  });

  it('DELETE /:id forwards the id to supplies.remove', () => {
    void controller.remove('s1');
    expect(suppliesService.remove).toHaveBeenCalledWith('s1');
  });

  it('GET /:id/movements forwards the id to supplies.listMovements', () => {
    void controller.listMovements('s1');
    expect(suppliesService.listMovements).toHaveBeenCalledWith('s1');
  });

  it('POST /:id/movements forwards id and body to supplies.registerMovement', () => {
    const movement = { type: MovementType.IN, quantity: 5 };
    void controller.registerMovement('s1', movement);
    expect(suppliesService.registerMovement).toHaveBeenCalledWith(
      's1',
      movement,
    );
  });
});
