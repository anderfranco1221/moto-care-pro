import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-tenant/client';
import { PrismaClientManager } from '../tenancy/prisma-client-manager.service';
import { TenantContextService } from '../tenancy/tenant-context.service';

type ModelDelegate = Record<string, (...args: unknown[]) => unknown>;

/**
 * Stands in for a tenant PrismaClient, but resolves the real client lazily
 * on every property access — via PrismaClientManager + the CLS-backed
 * tenant context (see TenantContextService) — instead of holding one fixed
 * connection. Consumers keep writing `this.prisma.motorcycle.findMany()`
 * exactly as if this were a plain injected PrismaClient; which tenant's
 * schema that resolves to depends entirely on the current request's
 * JWT-derived context (set in JwtStrategy.validate).
 *
 * Deliberately NOT Scope.REQUEST: that would force every provider that
 * injects this, transitively, to also become request-scoped — the Proxy
 * indirection gets per-request routing without that cost.
 *
 * Only supports the `client.<model>.<method>(...)` shape actually used in
 * this codebase (see MotorcyclesService) — not top-level PrismaClient
 * methods like `$transaction`/`$queryRaw`. Extend resolveModel's caller if
 * a future consumer needs those.
 */
@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TenantPrismaService {
  constructor(
    private readonly clientManager: PrismaClientManager,
    private readonly tenantContext: TenantContextService,
  ) {
    return new Proxy(this, {
      get: (target, modelName, receiver) => {
        if (typeof modelName === 'symbol' || modelName in target) {
          return Reflect.get(target, modelName, receiver);
        }
        return new Proxy(
          {},
          {
            get: (_t, methodName) => {
              if (typeof methodName === 'symbol') {
                return undefined;
              }
              return (...args: unknown[]) =>
                target
                  .resolveModel(modelName)
                  .then((model) => model[methodName](...args));
            },
          },
        );
      },
    });
  }

  private async resolveModel(modelName: string): Promise<ModelDelegate> {
    const client = await this.clientManager.getClient(
      this.tenantContext.getSchemaName(),
    );
    return (client as unknown as Record<string, ModelDelegate>)[modelName];
  }
}

// Declaration merging, not runtime inheritance: gives consumers (e.g.
// MotorcyclesService) real `.motorcycle`/`.service`/`.appointment` typing —
// matching PrismaClient's shape — without this class actually extending
// PrismaClient, since the Proxy above is what provides those properties
// at runtime, not the class body itself.
/* eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging,
   @typescript-eslint/no-empty-object-type -- deliberate: see comment above */
export interface TenantPrismaService extends PrismaClient {}
