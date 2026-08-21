import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };

  beforeEach(async () => {
    usersService = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: () => 'test-secret' },
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('devuelve el usuario sin password cuando existe', async () => {
      usersService.findById.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        password: 'hashed',
      });

      const result = await strategy.validate({ sub: '1', email: 'a@a.com' });

      expect(result).not.toHaveProperty('password');
      expect(result).toEqual({ id: '1', email: 'a@a.com' });
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: '1', email: 'a@a.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
