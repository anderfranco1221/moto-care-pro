import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';

describe('ServicesController', () => {
  let controller: ServicesController;
  let servicesService: Record<keyof ServicesService, jest.Mock>;

  beforeEach(async () => {
    servicesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [{ provide: ServicesService, useValue: servicesService }],
    }).compile();

    controller = module.get(ServicesController);
  });

  const dto: CreateServiceDto = {
    motorcycleId: '11111111-1111-1111-1111-111111111111',
    description: 'Cambio de aceite',
  };

  it('POST / forwards the body to services.create', () => {
    void controller.create(dto);
    expect(servicesService.create).toHaveBeenCalledWith(dto);
  });

  it('GET / forwards to services.findAll', () => {
    void controller.findAll();
    expect(servicesService.findAll).toHaveBeenCalledWith();
  });

  it('GET /:id forwards the id to services.findOne', () => {
    void controller.findOne('s1');
    expect(servicesService.findOne).toHaveBeenCalledWith('s1');
  });

  it('PATCH /:id forwards id and body to services.update', () => {
    void controller.update('s1', { mechanic: 'Ana' });
    expect(servicesService.update).toHaveBeenCalledWith('s1', {
      mechanic: 'Ana',
    });
  });

  it('DELETE /:id forwards the id to services.remove', () => {
    void controller.remove('s1');
    expect(servicesService.remove).toHaveBeenCalledWith('s1');
  });
});
