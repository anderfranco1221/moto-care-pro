import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let queryRaw: jest.Mock;
  let config: Record<string, string>;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    config = { HEALTH_CHECK_ENABLED: 'true' };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports ok when the database answers', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('404s when HEALTH_CHECK_ENABLED is not "true"', async () => {
    config.HEALTH_CHECK_ENABLED = 'false';
    await expect(controller.check()).rejects.toBeInstanceOf(NotFoundException);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('503s when the database query throws', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
