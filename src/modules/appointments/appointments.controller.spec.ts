import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { AuthenticatedUser } from '../auth/auth.service';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let appointmentsService: Record<keyof AppointmentsService, jest.Mock>;

  beforeEach(async () => {
    appointmentsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        { provide: AppointmentsService, useValue: appointmentsService },
      ],
    }).compile();

    controller = module.get(AppointmentsController);
  });

  const dto: CreateAppointmentDto = {
    motorcycleId: '11111111-1111-1111-1111-111111111111',
    scheduledAt: '2026-10-01T09:00:00.000Z',
  };
  const user = {
    id: '22222222-2222-2222-2222-222222222222',
  } as AuthenticatedUser;

  it('POST / forwards the body and the authenticated user id', () => {
    void controller.create(dto, user);
    expect(appointmentsService.create).toHaveBeenCalledWith(dto, user.id);
  });

  it('GET / forwards to appointments.findAll', () => {
    void controller.findAll();
    expect(appointmentsService.findAll).toHaveBeenCalledWith();
  });

  it('GET /:id forwards the id to appointments.findOne', () => {
    void controller.findOne('a1');
    expect(appointmentsService.findOne).toHaveBeenCalledWith('a1');
  });

  it('PATCH /:id forwards id and body to appointments.update', () => {
    void controller.update('a1', { notes: 'Reprogramar' });
    expect(appointmentsService.update).toHaveBeenCalledWith('a1', {
      notes: 'Reprogramar',
    });
  });

  it('DELETE /:id forwards the id to appointments.remove', () => {
    void controller.remove('a1');
    expect(appointmentsService.remove).toHaveBeenCalledWith('a1');
  });
});
