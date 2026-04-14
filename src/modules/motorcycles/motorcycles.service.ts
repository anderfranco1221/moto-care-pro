import { Injectable } from '@nestjs/common';
import { CreateMotorcycleDto } from './dto/create-motorcycle.dto';
import { UpdateMotorcycleDto } from './dto/update-motorcycle.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MotorcyclesService {
  constructor(private prisma: PrismaService) {}

  create(createMotorcycleDto: CreateMotorcycleDto) {
    return 'This action adds a new motorcycle';
  }

  findAll() {
    return this.prisma.motorcycle.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} motorcycle`;
  }

  update(id: number, updateMotorcycleDto: UpdateMotorcycleDto) {
    return `This action updates a #${id} motorcycle`;
  }

  remove(id: number) {
    return `This action removes a #${id} motorcycle`;
  }
}
