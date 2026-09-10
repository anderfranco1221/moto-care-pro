import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ProvisioningStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { TenantProvisioningService } from '../tenants/tenant-provisioning.service';
import { PrismaService } from 'src/prisma/prisma.service';

export type AuthenticatedUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly tenantProvisioning: TenantProvisioningService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates the workshop's Tenant and its first (owner) User atomically —
   * a duplicate email must not leave a dangling Tenant with no User — then
   * provisions the tenant's Postgres schema.
   *
   * Provisioning runs after the transaction commits, not inside it: it
   * shells out to `prisma migrate deploy` (~1-2s), too long to hold a DB
   * transaction open. A failure there is not fatal to registration — the
   * Tenant/User rows exist with provisioningStatus PENDING/FAILED and the
   * next login re-drives provisioning (see signIn). The caller is not left
   * unable to retry (duplicate email) or use the app.
   */
  async register(createUserDto: CreateUserDto): Promise<AuthenticatedUser> {
    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await this.tenantsService.create(
        createUserDto.tenantName,
        tx,
      );
      const user = await this.usersService.create(createUserDto, tenant.id, tx);
      return { user, tenant };
    });

    await this.tenantProvisioning.ensureProvisioned(tenant);

    const { password, ...result } = user;
    return result;
  }

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(email);
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      throw new UnauthorizedException();
    }

    // Recovery path: if the tenant's schema never finished provisioning at
    // signup, re-drive it now rather than hand out a token that 500s on
    // every tenant-scoped route. Idempotent and cheap once READY.
    const status = await this.tenantProvisioning.ensureProvisioned(user.tenant);
    if (status !== ProvisioningStatus.READY) {
      throw new ServiceUnavailableException(
        'El espacio de trabajo del taller aún se está preparando. Intenta de nuevo en unos segundos.',
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      schemaName: user.tenant.schemaName,
    };
    return { access_token: await this.jwtService.signAsync(payload) };
  }
}
