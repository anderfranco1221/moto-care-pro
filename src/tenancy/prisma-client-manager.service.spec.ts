import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientManager } from './prisma-client-manager.service';

interface FakeClient {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
}

describe('PrismaClientManager', () => {
  let manager: PrismaClientManager;
  let createClientSpy: jest.SpyInstance;
  let fakeClients: Record<string, FakeClient>;

  beforeEach(async () => {
    fakeClients = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaClientManager,
        {
          provide: ConfigService,
          useValue: {
            get: () => 'postgresql://admin:1234@localhost:5433/moto-pro',
          },
        },
      ],
    }).compile();

    manager = module.get(PrismaClientManager);

    createClientSpy = jest
      .spyOn(
        manager as unknown as { createClient: (s: string) => unknown },
        'createClient',
      )
      .mockImplementation((schemaName: unknown) => {
        const client: FakeClient = {
          $connect: jest.fn().mockResolvedValue(undefined),
          $disconnect: jest.fn().mockResolvedValue(undefined),
        };
        fakeClients[schemaName as string] = client;
        return client;
      });
  });

  it('creates and connects a client on cache miss', async () => {
    const client = await manager.getClient('tenant_a');

    expect(createClientSpy).toHaveBeenCalledTimes(1);
    expect(createClientSpy).toHaveBeenCalledWith('tenant_a');
    expect(fakeClients.tenant_a.$connect).toHaveBeenCalledTimes(1);
    expect(client).toBe(fakeClients.tenant_a);
  });

  it('reuses the cached client on a second call for the same schema', async () => {
    const first = await manager.getClient('tenant_a');
    const second = await manager.getClient('tenant_a');

    expect(createClientSpy).toHaveBeenCalledTimes(1);
    expect(fakeClients.tenant_a.$connect).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('awaits a single connect for two concurrent calls on the same not-yet-cached schema', async () => {
    const [a, b] = await Promise.all([
      manager.getClient('tenant_a'),
      manager.getClient('tenant_a'),
    ]);

    expect(createClientSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('creates independent clients for different schemas', async () => {
    const a = await manager.getClient('tenant_a');
    const b = await manager.getClient('tenant_b');

    expect(createClientSpy).toHaveBeenCalledTimes(2);
    expect(a).not.toBe(b);
  });

  it('rejects an unsafe schema name without creating a client', async () => {
    await expect(manager.getClient('bad name')).rejects.toThrow();
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it('evicts the cache entry when connect rejects, so the next call retries', async () => {
    createClientSpy.mockReset();
    createClientSpy
      .mockImplementationOnce(() => ({
        $connect: jest.fn().mockRejectedValue(new Error('PG down')),
        $disconnect: jest.fn().mockResolvedValue(undefined),
      }))
      .mockImplementationOnce((schemaName: unknown) => {
        const client: FakeClient = {
          $connect: jest.fn().mockResolvedValue(undefined),
          $disconnect: jest.fn().mockResolvedValue(undefined),
        };
        fakeClients[schemaName as string] = client;
        return client;
      });

    await expect(manager.getClient('tenant_a')).rejects.toThrow('PG down');

    // Not a permanently-cached rejected Promise: the retry gets a fresh client.
    const client = await manager.getClient('tenant_a');
    expect(createClientSpy).toHaveBeenCalledTimes(2);
    expect(client).toBe(fakeClients.tenant_a);
  });

  it('disconnects and clears every cached client on module destroy', async () => {
    await manager.getClient('tenant_a');
    await manager.getClient('tenant_b');

    await manager.onModuleDestroy();

    expect(fakeClients.tenant_a.$disconnect).toHaveBeenCalledTimes(1);
    expect(fakeClients.tenant_b.$disconnect).toHaveBeenCalledTimes(1);

    await manager.getClient('tenant_a');
    expect(createClientSpy).toHaveBeenCalledTimes(3);
  });
});
