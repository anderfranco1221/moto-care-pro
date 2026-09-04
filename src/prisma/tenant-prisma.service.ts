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
 * methods like `$transaction`/`$queryRaw`. The declaration-merged interface
 * below exposes exactly the model delegates the Proxy actually resolves, so
 * calling `this.prisma.$transaction(...)` is a compile error rather than a
 * runtime "is not a function". Widen it (and resolveModel's caller) if a
 * future consumer needs another model or a top-level method.
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
// matching PrismaClient's delegate shape — without this class extending
// PrismaClient, since the Proxy above is what provides those properties at
// runtime, not the class body. Deliberately narrow: only the model
// delegates the Proxy resolves, so `$transaction`/`$queryRaw`/`$connect`
// (which the Proxy does NOT implement) don't type-check as available.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TenantPrismaService {
  motorcycle: PrismaClient['motorcycle'];
  service: PrismaClient['service'];
  appointment: PrismaClient['appointment'];
}
