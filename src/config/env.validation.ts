import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  validateSync,
} from 'class-validator';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

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

  // Optional: pino level (see src/common/logger.config.ts). Defaults by
  // NODE_ENV when unset.
  @IsOptional()
  @IsIn(LOG_LEVELS)
  LOG_LEVEL?: (typeof LOG_LEVELS)[number];
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
