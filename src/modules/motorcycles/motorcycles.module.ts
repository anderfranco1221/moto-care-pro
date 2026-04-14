import { Module } from '@nestjs/common';
import { MotorcyclesService } from './motorcycles.service';
import { MotorcyclesController } from './motorcycles.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [MotorcyclesController],
  providers: [MotorcyclesService, PrismaService],
})
export class MotorcyclesModule {}
