import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let appointment: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let motorcycle: { findUnique: jest.Mock };

  const USER_ID = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    appointment = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    motorcycle = { findUnique: jest.fn().mockResolvedValue({ id: 'm1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: TenantPrismaService,
          useValue: { appointment, motorcycle },
        },
      ],
    }).compile();

    service = module.get(AppointmentsService);
  });

  const dto: CreateAppointmentDto = {
    motorcycleId: '11111111-1111-1111-1111-111111111111',
    scheduledAt: '2026-10-01T09:00:00.000Z',
  };

  it('create() checks the motorcycle exists and stamps the userId', async () => {
    appointment.create.mockResolvedValue({ id: 'a1', ...dto, userId: USER_ID });

    await service.create(dto, USER_ID);

    expect(motorcycle.findUnique).toHaveBeenCalledWith({
      where: { id: dto.motorcycleId },
    });
    expect(appointment.create).toHaveBeenCalledWith({
      data: { ...dto, userId: USER_ID },
    });
  });

  it('create() throws 404 when the motorcycle does not exist', async () => {
    motorcycle.findUnique.mockResolvedValue(null);

    await expect(service.create(dto, USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(appointment.create).not.toHaveBeenCalled();
  });

  it('findAll() returns every appointment', async () => {
    appointment.findMany.mockResolvedValue([{ id: 'a1' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 'a1' }]);
  });

  it('findOne() returns the row when found', async () => {
    appointment.findUnique.mockResolvedValue({ id: 'a1' });

    await expect(service.findOne('a1')).resolves.toEqual({ id: 'a1' });
  });

  it('findOne() throws 404 when the row is missing', async () => {
    appointment.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update() writes the patch to the matching row', async () => {
    await service.update('a1', { notes: 'Traer repuesto' });
    expect(appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { notes: 'Traer repuesto' },
    });
  });

  it('remove() deletes by id', async () => {
    await service.remove('a1');
    expect(appointment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
