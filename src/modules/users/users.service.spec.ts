import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('busca un usuario por email', async () => {
      const user = { id: '1', email: 'a@a.com' };
      prisma.user.findFirst.mockResolvedValue(user);

      const result = await service.findOne('a@a.com');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'a@a.com' },
      });
      expect(result).toBe(user);
    });
  });

  describe('findById', () => {
    it('busca un usuario por id', async () => {
      const user = { id: '1', email: 'a@a.com' };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toBe(user);
    });
  });

  describe('create', () => {
    it('hashea la contraseña antes de persistir', async () => {
      let persistedPassword = '';
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(
        ({ data }: { data: { password: string } }) => {
          persistedPassword = data.password;
          return Promise.resolve({ id: '1', ...data });
        },
      );

      const result = await service.create(
        { email: 'a@a.com', password: 'plain-password', tenantName: 'Taller' },
        'tenant-1',
      );

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(persistedPassword).not.toBe('plain-password');
      await expect(
        bcrypt.compare('plain-password', persistedPassword),
      ).resolves.toBe(true);
      expect(result.password).toBe(persistedPassword);
    });

    it('lanza ConflictException si el email ya existe', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: '1', email: 'a@a.com' });

      await expect(
        service.create(
          {
            email: 'a@a.com',
            password: 'plain-password',
            tenantName: 'Taller',
          },
          'tenant-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
});
