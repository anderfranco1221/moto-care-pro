import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { TenantContextService } from '../../../tenancy/tenant-context.service';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  schemaName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tenantContext: TenantContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    // Runs before the route handler (Passport's validate() completes before
    // the guard lets the request through) — this is the one hook point
    // every authenticated request passes through, so it's where tenant
    // context gets set for everything downstream (TenantPrismaService, etc).
    this.tenantContext.setTenant(payload.tenantId, payload.schemaName);
    const { password, ...result } = user;
    return result;
  }
}
