import { Test, TestingModule } from '@nestjs/testing';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
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
        AppointmentsService,
        {
          provide: TenantPrismaService,
          useValue: { appointment: prismaService },
        },
      ],
    }).compile();

    service = module.get(AppointmentsService);
  });

  const dto: CreateAppointmentDto = {
    userId: '22222222-2222-2222-2222-222222222222',
    motorcycleId: '11111111-1111-1111-1111-111111111111',
    scheduledAt: '2026-10-01T09:00:00.000Z',
  };

  it('create() delegates to prisma.appointment.create with the dto', async () => {
    prismaService.create.mockResolvedValue({ id: 'a1', ...dto });

    await expect(service.create(dto)).resolves.toEqual({ id: 'a1', ...dto });
    expect(prismaService.create).toHaveBeenCalledWith({ data: dto });
  });

  it('findAll() returns every appointment', async () => {
    prismaService.findMany.mockResolvedValue([{ id: 'a1' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 'a1' }]);
    expect(prismaService.findMany).toHaveBeenCalledWith();
  });

  it('findOne() looks up by id', async () => {
    prismaService.findUnique.mockResolvedValue({ id: 'a1' });

    await service.findOne('a1');
    expect(prismaService.findUnique).toHaveBeenCalledWith({
      where: { id: 'a1' },
    });
  });

  it('update() writes the patch to the matching row', async () => {
    await service.update('a1', { notes: 'Traer repuesto' });
    expect(prismaService.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { notes: 'Traer repuesto' },
    });
  });

  it('remove() deletes by id', async () => {
    await service.remove('a1');
    expect(prismaService.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
