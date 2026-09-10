import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma-tenant/client';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: TenantPrismaService) {}

  create(dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: dto as Prisma.ServiceUncheckedCreateInput,
    });
  }

  findAll() {
    return this.prisma.service.findMany();
  }

  findOne(id: string) {
    return this.prisma.service.findUnique({ where: { id } });
  }

  update(id: string, dto: UpdateServiceDto) {
    return this.prisma.service.update({
      where: { id },
      data: dto as Prisma.ServiceUncheckedUpdateInput,
    });
  }

  remove(id: string) {
    return this.prisma.service.delete({ where: { id } });
  }
}
