import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma-tenant/client';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { orNotFound } from 'src/common/not-found';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async create(dto: CreateAppointmentDto, userId: string) {
    await this.assertMotorcycleExists(dto.motorcycleId);
    return this.prisma.appointment.create({
      data: { ...dto, userId } as Prisma.AppointmentUncheckedCreateInput,
    });
  }

  findAll() {
    return this.prisma.appointment.findMany();
  }

  async findOne(id: string) {
    return orNotFound(
      await this.prisma.appointment.findUnique({ where: { id } }),
      'Appointment',
    );
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    if (dto.motorcycleId) {
      await this.assertMotorcycleExists(dto.motorcycleId);
    }
    return this.prisma.appointment.update({
      where: { id },
      data: dto as Prisma.AppointmentUncheckedUpdateInput,
    });
  }

  remove(id: string) {
    return this.prisma.appointment.delete({ where: { id } });
  }

  private async assertMotorcycleExists(motorcycleId: string): Promise<void> {
    orNotFound(
      await this.prisma.motorcycle.findUnique({ where: { id: motorcycleId } }),
      'Motorcycle',
    );
  }
}
