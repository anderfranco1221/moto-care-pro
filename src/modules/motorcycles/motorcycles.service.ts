import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateMotorcycleDto } from './dto/create-motorcycle.dto';
import { UpdateMotorcycleDto } from './dto/update-motorcycle.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MotorcyclesService {
  constructor(private prisma: PrismaService) {}

  create(createMotorcycleDto: CreateMotorcycleDto) {
    return this.prisma.motorcycle.create({
      data: createMotorcycleDto as Prisma.MotorcycleCreateInput,
    });
  }

  findAll() {
    return this.prisma.motorcycle.findMany();
  }

  findOne(id: string) {
    return this.prisma.motorcycle.findFirst({
      where: {
        id: id,
      },
    });
  }

  update(id: string, updateMotorcycleDto: UpdateMotorcycleDto) {
    const motorCycle = this.prisma.motorcycle.update({
      where: {
        id: id,
      },
      data: updateMotorcycleDto as Prisma.MotorcycleCreateInput,
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
