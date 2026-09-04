import { Injectable, Logger } from '@nestjs/common';
import { ProvisioningStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { provisionTenantSchema } from '../../tenancy/provision-tenant-schema';

export interface ProvisionableTenant {
  id: string;
  schemaName: string;
  provisioningStatus: ProvisioningStatus;
}

/**
 * Owns the Tenant.provisioningStatus state machine. Schema provisioning
 * (CREATE SCHEMA + `prisma migrate deploy`) runs after the Tenant+User
 * transaction commits, so it can fail on its own; this service makes that
 * failure recoverable instead of a dead end:
 *
 *   PENDING  -> register() created the rows, schema not confirmed yet
 *   READY    -> schema exists and is migrated, safe to route tenant queries
 *   FAILED   -> last attempt threw; will be retried on the next login
 *
 * `ensureProvisioned` is idempotent and cheap for a READY tenant, so
 * AuthService.signIn calls it on every login as the recovery path.
 */
@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureProvisioned(
    tenant: ProvisionableTenant,
  ): Promise<ProvisioningStatus> {
    if (tenant.provisioningStatus === ProvisioningStatus.READY) {
      return ProvisioningStatus.READY;
    }

    try {
      await provisionTenantSchema(tenant.schemaName);
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { provisioningStatus: ProvisioningStatus.READY },
      });
      return ProvisioningStatus.READY;
    } catch (error) {
      this.logger.error(
        `Schema provisioning failed for tenant ${tenant.id} (${tenant.schemaName})`,
        error instanceof Error ? error.stack : String(error),
      );
      // Best-effort: if this write also fails the row just stays PENDING,
      // which is retried on the next login exactly the same as FAILED.
      await this.prisma.tenant
        .update({
          where: { id: tenant.id },
          data: { provisioningStatus: ProvisioningStatus.FAILED },
        })
        .catch(() => undefined);
      return ProvisioningStatus.FAILED;
    }
  }
}
