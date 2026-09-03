import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { PrismaClientManager } from './prisma-client-manager.service';

// Global so JwtStrategy (in AuthModule) and every future tenant-scoped
// feature module can inject TenantContextService/PrismaClientManager
// without each one threading an explicit import — see PrismaModule, which
// relies on this too.
@Global()
@Module({
  providers: [TenantContextService, PrismaClientManager],
  exports: [TenantContextService, PrismaClientManager],
})
export class TenancyModule {}
