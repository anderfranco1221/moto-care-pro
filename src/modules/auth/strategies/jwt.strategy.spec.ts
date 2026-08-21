import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { TenantContextService } from '../../../tenancy/tenant-context.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };
  let tenantContext: { setTenant: jest.Mock };

  beforeEach(async () => {
    usersService = { findById: jest.fn() };
    tenantContext = { setTenant: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: () => 'test-secret' },
        },
        { provide: UsersService, useValue: usersService },
        { provide: TenantContextService, useValue: tenantContext },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const payload = {
      sub: '1',
      email: 'a@a.com',
      tenantId: 'tenant-1',
      schemaName: 'tenant_taller_abcd1234',
    };

    it('devuelve el usuario sin password cuando existe', async () => {
      usersService.findById.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        password: 'hashed',
      });

      const result = await strategy.validate(payload);

      expect(result).not.toHaveProperty('password');
      expect(result).toEqual({ id: '1', email: 'a@a.com' });
    });

    it('setea el contexto de tenant con los claims del payload', async () => {
      usersService.findById.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        password: 'hashed',
      });

      await strategy.validate(payload);

      expect(tenantContext.setTenant).toHaveBeenCalledWith(
        'tenant-1',
        'tenant_taller_abcd1234',
      );
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tenantContext.setTenant).not.toHaveBeenCalled();
    });
  });
});
