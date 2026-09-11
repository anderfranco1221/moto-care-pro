import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, Prisma } from '@prisma-tenant/client';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { orNotFound } from 'src/common/not-found';
import { CreateServiceDto, ServiceSupplyDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async create(dto: CreateServiceDto) {
    const { supplies, ...serviceData } = dto;
    await this.assertMotorcycleExists(serviceData.motorcycleId);

    if (!supplies?.length) {
      return this.prisma.service.create({
        data: serviceData as Prisma.ServiceUncheckedCreateInput,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const service = await tx.service.create({
        data: serviceData as Prisma.ServiceUncheckedCreateInput,
      });
      for (const line of supplies) {
        await this.consumeSupply(tx, service.id, line);
      }
      return tx.service.findUnique({
        where: { id: service.id },
        include: { stockMovements: true },
      });
    });
  }

  findAll() {
    return this.prisma.service.findMany();
  }

  async findOne(id: string) {
    return orNotFound(
      await this.prisma.service.findUnique({ where: { id } }),
      'Service',
    );
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

  private async assertMotorcycleExists(motorcycleId: string): Promise<void> {
    orNotFound(
      await this.prisma.motorcycle.findUnique({ where: { id: motorcycleId } }),
      'Motorcycle',
    );
  }

  /** Deducts one supply line from stock and records the OUT movement. */
  private async consumeSupply(
    tx: Prisma.TransactionClient,
    serviceId: string,
    { supplyId, quantity }: ServiceSupplyDto,
  ): Promise<void> {
    const { count } = await tx.supply.updateMany({
      where: { id: supplyId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (count === 0) {
      const supply = await tx.supply.findUnique({ where: { id: supplyId } });
      if (!supply) {
        throw new NotFoundException(`Supply ${supplyId} not found`);
      }
      throw new ConflictException(
        `Insufficient stock for supply ${supplyId}: ${supply.stock} available, ${quantity} requested`,
      );
    }
    await tx.stockMovement.create({
      data: {
        supplyId,
        serviceId,
        type: MovementType.OUT,
        quantity,
        reason: `service:${serviceId}`,
      },
    });
  }
}
