import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { provisionTenantSchema } from '../../tenancy/provision-tenant-schema';

export type AuthenticatedUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates the workshop's Tenant and its first (owner) User atomically —
   * a duplicate email must not leave a dangling Tenant with no User — then
   * provisions the tenant's Postgres schema. Provisioning runs after the
   * transaction commits, not inside it: it shells out to `prisma migrate
   * deploy` (roughly a second), and holding a DB transaction open for that
   * long is worse than the alternative failure mode here (schema
   * provisioning fails after Tenant+User already exist — recoverable by
   * re-running `npm run migrate:tenants`, not a silent data-integrity bug).
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

    await provisionTenantSchema(tenant.schemaName);

    const { password, ...result } = user;
    return result;
  }

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(email);
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      throw new UnauthorizedException();
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
