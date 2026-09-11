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
 * Supports the `client.<model>.<method>(...)` shape (see MotorcyclesService)
 * plus `$transaction`, which forwards straight to the resolved per-tenant
 * client. The declaration-merged interface below exposes exactly what the
 * Proxy resolves, so calling e.g. `this.prisma.$queryRaw(...)` is a compile
 * error rather than a runtime "is not a function" — widen it (the interface
 * and the Proxy's `$`-prefix branch) if a future consumer needs more.
 */
@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TenantPrismaService {
  constructor(
    private readonly clientManager: PrismaClientManager,
    private readonly tenantContext: TenantContextService,
  ) {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === 'symbol' || prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        // Top-level client methods (`$transaction`, ...) forward straight to
        // the resolved client — the domain uses `$transaction` to keep a
        // Service and the stock movements it consumes in one atomic write.
        if (prop.startsWith('$')) {
          return (...args: unknown[]) =>
            target
              .resolveClient()
              .then((client) =>
                (client as unknown as ModelDelegate)[prop](...args),
              );
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
                  .resolveModel(prop)
                  .then((model) => model[methodName](...args));
            },
          },
        );
      },
    });
  }

  private resolveClient(): Promise<PrismaClient> {
    return this.clientManager.getClient(this.tenantContext.getSchemaName());
  }

  private async resolveModel(modelName: string): Promise<ModelDelegate> {
    const client = await this.resolveClient();
    return (client as unknown as Record<string, ModelDelegate>)[modelName];
  }
}

// Declaration merging, not runtime inheritance: gives consumers (e.g.
// MotorcyclesService) real `.motorcycle`/`.service`/`.appointment` typing —
// matching PrismaClient's delegate shape — without this class extending
// PrismaClient, since the Proxy above is what provides those properties at
// runtime, not the class body. Narrow on purpose: the model delegates the
// Proxy resolves, plus `$transaction` (forwarded to the resolved client).
// `$queryRaw`/`$connect` etc. stay off the type until something needs them.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TenantPrismaService {
  motorcycle: PrismaClient['motorcycle'];
  service: PrismaClient['service'];
  appointment: PrismaClient['appointment'];
  supply: PrismaClient['supply'];
  stockMovement: PrismaClient['stockMovement'];
  $transaction: PrismaClient['$transaction'];
}
