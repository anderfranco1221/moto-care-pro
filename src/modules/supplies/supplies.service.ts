import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, Prisma } from '@prisma-tenant/client';
import { TenantPrismaService } from 'src/prisma/tenant-prisma.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { RegisterMovementDto } from './dto/register-movement.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';

@Injectable()
export class SuppliesService {
  constructor(private readonly prisma: TenantPrismaService) {}

  create(dto: CreateSupplyDto) {
    return this.prisma.supply.create({
      data: dto as Prisma.SupplyUncheckedCreateInput,
    });
  }

  findAll() {
    return this.prisma.supply.findMany();
  }

  findOne(id: string) {
    return this.prisma.supply.findUnique({ where: { id } });
  }

  update(id: string, dto: UpdateSupplyDto) {
    return this.prisma.supply.update({
      where: { id },
      data: dto as Prisma.SupplyUncheckedUpdateInput,
    });
  }

  remove(id: string) {
    return this.prisma.supply.delete({ where: { id } });
  }

  listMovements(supplyId: string) {
    return this.prisma.stockMovement.findMany({
      where: { supplyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Records a stock movement and applies its delta to Supply.stock in one
   * nested write, so the running total can never drift from the history.
   * An OUT movement is refused (409) when it would take stock below zero —
   * the conditional `where` makes that check atomic with the decrement.
   */
  async registerMovement(supplyId: string, dto: RegisterMovementDto) {
    const isOut = dto.type === MovementType.OUT;
    const delta = isOut ? -dto.quantity : dto.quantity;

    try {
      return await this.prisma.supply.update({
        where: isOut
          ? { id: supplyId, stock: { gte: dto.quantity } }
          : { id: supplyId },
        data: {
          stock: { increment: delta },
          movements: {
            create: {
              type: dto.type,
              quantity: dto.quantity,
              reason: dto.reason,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        const exists = await this.prisma.supply.findUnique({
          where: { id: supplyId },
        });
        if (!exists) {
          throw new NotFoundException(`Supply ${supplyId} not found`);
        }
        throw new ConflictException(
          `Insufficient stock: ${exists.stock} available, ${dto.quantity} requested`,
        );
      }
      throw error;
    }
  }
}
