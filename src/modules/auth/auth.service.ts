import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { PrismaService } from 'src/prisma/prisma.service';

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
   * a duplicate email must not leave a dangling Tenant with no User.
   */
  async register(createUserDto: CreateUserDto): Promise<AuthenticatedUser> {
    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await this.tenantsService.create(
        createUserDto.tenantName,
        tx,
      );
      return this.usersService.create(createUserDto, tenant.id, tx);
    });
    const { password, ...result } = user;
    return result;
  }

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.validateUser(email, pass);
    const payload = { sub: user.id, email: user.email };
    return { access_token: await this.jwtService.signAsync(payload) };
  }

  private async validateUser(
    email: string,
    pass: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.usersService.findOne(email);
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      throw new UnauthorizedException();
    }
    const { password, ...result } = user;
    return result;
  }
}
