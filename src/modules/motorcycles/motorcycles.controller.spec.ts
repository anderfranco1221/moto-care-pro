import { Test, TestingModule } from '@nestjs/testing';
import { MotorcyclesController } from './motorcycles.controller';
import { MotorcyclesService } from './motorcycles.service';
import { CreateMotorcycleDto } from './dto/create-motorcycle.dto';

describe('MotorcyclesController', () => {
  let controller: MotorcyclesController;
  let motorcyclesService: Record<keyof MotorcyclesService, jest.Mock>;

  beforeEach(async () => {
    motorcyclesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MotorcyclesController],
      providers: [
        { provide: MotorcyclesService, useValue: motorcyclesService },
      ],
    }).compile();

    controller = module.get(MotorcyclesController);
  });

  const dto: CreateMotorcycleDto = {
    vin: 'JH2PC37G3MK000001',
    brand: 'Honda',
    model: 'CB500',
    year: 2021,
    ownerId: '11111111-1111-4111-8111-111111111111',
  };

  it('POST / forwards the body to motorcycles.create', () => {
    void controller.create(dto);
    expect(motorcyclesService.create).toHaveBeenCalledWith(dto);
  });

  it('GET / forwards to motorcycles.findAll', () => {
    void controller.findAll();
    expect(motorcyclesService.findAll).toHaveBeenCalledWith();
  });

  it('GET /:id forwards the id to motorcycles.findOne', () => {
    void controller.findOne('m1');
    expect(motorcyclesService.findOne).toHaveBeenCalledWith('m1');
  });

  it('PATCH /:id forwards id and body to motorcycles.update', () => {
    void controller.update('m1', { model: 'CB650' });
    expect(motorcyclesService.update).toHaveBeenCalledWith('m1', {
      model: 'CB650',
    });
  });

  it('DELETE /:id forwards the id to motorcycles.remove', () => {
    void controller.remove('m1');
    expect(motorcyclesService.remove).toHaveBeenCalledWith('m1');
  });
});
