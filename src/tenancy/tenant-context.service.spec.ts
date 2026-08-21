import { Controller, Get, INestApplication, Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsModule } from 'nestjs-cls';
import request from 'supertest';
import { App } from 'supertest/types';
import { TenantContextService } from './tenant-context.service';
import { TenancyModule } from './tenancy.module';

/**
 * Sets tenant context "as if" an auth middleware/strategy had already run
 * for this request, then reads it back from a downstream, request-agnostic
 * provider — proving the CLS store actually survives from Express middleware
 * through to a plain injected service, before anything real depends on it.
 */
@Injectable()
class DownstreamProbeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  readTenantId(): string {
    return this.tenantContext.getTenantId();
  }
}

@Controller('__cls-probe')
class ProbeController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly downstream: DownstreamProbeService,
  ) {}

  @Get()
  probe() {
    this.tenantContext.setTenant('tenant-42', 'tenant_probe');
    return { fromDownstreamService: this.downstream.readTenantId() };
  }

  @Get('unset')
  probeUnset() {
    return this.downstream.readTenantId();
  }
}

describe('TenantContextService (CLS propagation)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: true } }),
        TenancyModule,
      ],
      controllers: [ProbeController],
      providers: [DownstreamProbeService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('propagates a value set mid-request to a downstream injected provider', async () => {
    const response = await request(app.getHttpServer())
      .get('/__cls-probe')
      .expect(200);

    expect(response.body).toEqual({ fromDownstreamService: 'tenant-42' });
  });

  it('does not leak context between separate requests', async () => {
    await request(app.getHttpServer()).get('/__cls-probe').expect(200);

    await request(app.getHttpServer()).get('/__cls-probe/unset').expect(500);
  });
});
