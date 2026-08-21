import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';
import { TenancyModule } from '../tenancy/tenancy.module';

// Global: PrismaService/TenantPrismaService are cross-cutting infra needed
// by nearly every feature module (same justification as ConfigModule being
// global) — deliberate deviation from this repo's usual explicit-import
// convention.
@Global()
@Module({
  imports: [TenancyModule],
  providers: [PrismaService, TenantPrismaService],
  exports: [PrismaService, TenantPrismaService],
})
export class PrismaModule {}
