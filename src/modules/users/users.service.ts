import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Tenant, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const SALT_ROUNDS = 10;

export type UserWithTenant = User & { tenant: Tenant };

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** Includes the Tenant relation — AuthService.signIn needs schemaName for the JWT claim. */
  async findOne(email: string): Promise<UserWithTenant | null> {
    return this.prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });
  }

  /**
   * Includes the Tenant relation: JwtStrategy.validate derives the request's
   * tenant context from this freshly-loaded row rather than trusting the
   * token's tenant claim.
   */
  async findById(id: string): Promise<UserWithTenant | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });
  }

  /** `tx` lets AuthService.register run this in the same transaction as the new Tenant. */
  async create(
    createUserDto: CreateUserDto,
    tenantId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<User> {
    const existingUser = await tx.user.findFirst({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      SALT_ROUNDS,
    );

    return tx.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
        tenantId,
      },
    });
  }
}
