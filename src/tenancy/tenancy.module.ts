import { Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { PrismaClientManager } from './prisma-client-manager.service';

@Module({
  providers: [TenantContextService, PrismaClientManager],
  exports: [TenantContextService, PrismaClientManager],
})
export class TenancyModule {}
