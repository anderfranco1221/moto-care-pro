import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { signIn: jest.Mock; register: jest.Mock };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn().mockResolvedValue({ access_token: 'signed-token' }),
      register: jest.fn().mockResolvedValue({ id: '1', email: 'a@a.com' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signIn', () => {
    it('delega en authService.signIn con email y password', async () => {
      const result = await controller.signIn({
        email: 'a@a.com',
        password: 'plain-password',
      });

      expect(authService.signIn).toHaveBeenCalledWith(
        'a@a.com',
        'plain-password',
      );
      expect(result).toEqual({ access_token: 'signed-token' });
    });
  });

  describe('register', () => {
    it('delega en authService.register con el dto', async () => {
      const dto = { email: 'a@a.com', password: 'plain-password' };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: '1', email: 'a@a.com' });
    });
  });
});
