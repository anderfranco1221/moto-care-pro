import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  Max,
  validateSync,
} from 'class-validator';

/**
 * Fails the boot if a required env var is missing or malformed, instead of
 * letting the app come up "healthy" and 500 on the first request that needs
 * the value (how JWT_SECRET in Fase 1 and TENANT_DATABASE_URL here would
 * otherwise surface). Wired as ConfigModule.forRoot({ validate }).
 */
export class EnvVars {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // Per-tenant migrations are replayed against tenant_<x> schemas, never
  // against `public` — this must be set explicitly, not defaulted to
  // DATABASE_URL, so a misconfigured deploy fails loud at boot.
  @IsString()
  @IsNotEmpty()
  TENANT_DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN!: number;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}
