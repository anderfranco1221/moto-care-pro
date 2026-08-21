import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, Tenant } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  /** `tx` lets AuthService.register run this in the same transaction as the owner User. */
  create(
    name: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Tenant> {
    return tx.tenant.create({
      data: { name, schemaName: this.buildSchemaName(name) },
    });
  }

  /**
   * Placeholder naming scheme until Fase 2's PrismaClientManager/provisioning
   * script actually creates the Postgres schema for this name.
   */
  private buildSchemaName(name: string): string {
    // Fixed "tenant_" + "_" + 8 hex chars = 16 chars, leaving up to 47 for
    // the slug within Postgres's 63-char identifier limit (see
    // schema-name.util.ts's assertSafeSchemaName, which every schema name
    // is validated against before it's ever used in SQL) — capped well
    // under that so a long workshop name can't push it over.
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    return `tenant_${slug || 'workshop'}_${randomUUID().slice(0, 8)}`;
  }
}
