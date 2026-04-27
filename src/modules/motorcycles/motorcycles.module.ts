import { Module } from '@nestjs/common';
import { MotorcyclesService } from './motorcycles.service';
import { MotorcyclesController } from './motorcycles.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MotorcyclesController],
  providers: [MotorcyclesService],
})
export class MotorcyclesModule {}
