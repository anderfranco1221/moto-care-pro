import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TenantsService } from './tenants.service';
import { TenantProvisioningService } from './tenant-provisioning.service';

@Module({
  imports: [PrismaModule],
  providers: [TenantsService, TenantProvisioningService],
  exports: [TenantsService, TenantProvisioningService],
})
export class TenantsModule {}
