import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';

@Module({
  imports: [PrismaModule],
  controllers: [SuppliesController],
  providers: [SuppliesService],
})
export class SuppliesModule {}
