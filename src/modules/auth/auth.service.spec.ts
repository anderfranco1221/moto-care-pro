import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { provisionTenantSchema } from '../../tenancy/provision-tenant-schema';
import { AuthService } from './auth.service';

jest.mock('../../tenancy/provision-tenant-schema', () => ({
  provisionTenantSchema: jest.fn().mockResolvedValue(undefined),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let tenantsService: { create: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    usersService = { findOne: jest.fn(), create: jest.fn() };
    tenantsService = { create: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    // register() runs inside prisma.$transaction — the mock just invokes the
    // callback with a stand-in tx client, since usersService/tenantsService
    // are mocked directly and ignore it.
    prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TenantsService, useValue: tenantsService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('crea el tenant y el usuario, y devuelve el resultado sin password', async () => {
      tenantsService.create.mockResolvedValue({
        id: 'tenant-1',
        name: 'Taller',
        schemaName: 'tenant_taller_abcd1234',
        createdAt: new Date(),
      });
      usersService.create.mockResolvedValue({
        id: '1',
        tenantId: 'tenant-1',
        email: 'a@a.com',
        password: 'hashed',
        name: null,
        createdAt: new Date(),
      });

      const result = await service.register({
        email: 'a@a.com',
        password: 'plain-password',
        tenantName: 'Taller',
      });

      expect(tenantsService.create).toHaveBeenCalledWith('Taller', {});
      expect(usersService.create).toHaveBeenCalledWith(
        { email: 'a@a.com', password: 'plain-password', tenantName: 'Taller' },
        'tenant-1',
        {},
      );
      expect(provisionTenantSchema).toHaveBeenCalledWith(
        'tenant_taller_abcd1234',
      );
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('a@a.com');
    });
  });

  describe('signIn', () => {
    it('devuelve un access_token con los claims de tenant cuando las credenciales son válidas', async () => {
      const hashedPassword = await bcrypt.hash('plain-password', 10);
      usersService.findOne.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        password: hashedPassword,
        tenantId: 'tenant-1',
        tenant: { schemaName: 'tenant_taller_abcd1234' },
      });

      const result = await service.signIn('a@a.com', 'plain-password');

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: '1',
        email: 'a@a.com',
        tenantId: 'tenant-1',
        schemaName: 'tenant_taller_abcd1234',
      });
      expect(result).toEqual({ access_token: 'signed-token' });
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      usersService.findOne.mockResolvedValue(null);

      await expect(
        service.signIn('nope@a.com', 'plain-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña no coincide', async () => {
      const hashedPassword = await bcrypt.hash('other-password', 10);
      usersService.findOne.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        password: hashedPassword,
        tenantId: 'tenant-1',
        tenant: { schemaName: 'tenant_taller_abcd1234' },
      });

      await expect(service.signIn('a@a.com', 'plain-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
