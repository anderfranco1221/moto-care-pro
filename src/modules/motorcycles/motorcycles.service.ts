import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma-tenant/client';
import { CreateMotorcycleDto } from './dto/create-motorcycle.dto';
import { UpdateMotorcycleDto } from './dto/update-motorcycle.dto';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { orNotFound } from 'src/common/not-found';

@Injectable()
export class MotorcyclesService {
  constructor(private prisma: TenantPrismaService) {}

  create(createMotorcycleDto: CreateMotorcycleDto) {
    return this.prisma.motorcycle.create({
      data: createMotorcycleDto as Prisma.MotorcycleUncheckedCreateInput,
    });
  }

  findAll() {
    return this.prisma.motorcycle.findMany();
  }

  async findOne(id: string) {
    return orNotFound(
      await this.prisma.motorcycle.findUnique({ where: { id } }),
      'Motorcycle',
    );
  }

  update(id: string, updateMotorcycleDto: UpdateMotorcycleDto) {
    const motorCycle = this.prisma.motorcycle.update({
      where: {
        id: id,
      },
      data: updateMotorcycleDto as Prisma.MotorcycleUncheckedUpdateInput,
    });
    return motorCycle;
  }

  remove(id: string) {
    return this.prisma.motorcycle.delete({
      where: {
        id: id,
      },
    });
  }
}
