import { Injectable } from '@nestjs/common';
import { ClsService, ClsStore } from 'nestjs-cls';

export interface TenantClsStore extends ClsStore {
  tenantId: string;
  schemaName: string;
}

/**
 * Typed wrapper around the AsyncLocalStorage-backed CLS context carrying the
 * current request's tenant. Nothing sets these keys yet (Fase 2 task 4 wires
 * JwtStrategy to call setTenant) — the getters throw instead of returning
 * undefined so a tenant-scoped service reached from the wrong code path
 * (e.g. a @Public() route) fails loudly instead of silently misrouting data.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService<TenantClsStore>) {}

  getTenantId(): string {
    return this.require('tenantId');
  }

  getSchemaName(): string {
    return this.require('schemaName');
  }

  setTenant(tenantId: string, schemaName: string): void {
    this.cls.set('tenantId', tenantId);
    this.cls.set('schemaName', schemaName);
  }

  private require(key: 'tenantId' | 'schemaName'): string {
    const value = this.cls.get(key);
    if (!value) {
      throw new Error(
        `TenantContextService: no "${key}" set on the current request context`,
      );
    }
    return value;
  }
}
