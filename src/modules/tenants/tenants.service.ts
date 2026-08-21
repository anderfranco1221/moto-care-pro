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
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `tenant_${slug || 'workshop'}_${randomUUID().slice(0, 8)}`;
  }
}
