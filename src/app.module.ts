import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [MotorcyclesModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
