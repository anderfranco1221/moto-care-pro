import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = { findOne: jest.fn(), create: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('crea el usuario y devuelve el resultado sin password', async () => {
      usersService.create.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        password: 'hashed',
        name: null,
        createdAt: new Date(),
      });

      const result = await service.register({
        email: 'a@a.com',
        password: 'plain-password',
      });

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'a@a.com',
        password: 'plain-password',
      });
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('a@a.com');
    });
  });

  describe('signIn', () => {
    it('devuelve un access_token cuando las credenciales son válidas', async () => {
      const hashedPassword = await bcrypt.hash('plain-password', 10);
      usersService.findOne.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        password: hashedPassword,
      });

      const result = await service.signIn('a@a.com', 'plain-password');

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: '1',
        email: 'a@a.com',
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
      });

      await expect(service.signIn('a@a.com', 'plain-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
