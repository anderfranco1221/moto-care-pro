import type { Params } from 'nestjs-pino';

/**
 * pino logging config. Pretty single-line logs in development; plain JSON
 * (one object per line) everywhere else so a log shipper can parse it.
 * `LOG_LEVEL` overrides the level; tests set it to `silent`.
 */
export function loggerOptions(): Params {
  const isProduction = process.env.NODE_ENV === 'production';
  const level = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug');

  return {
    pinoHttp: {
      level,
      transport: isProduction
        ? undefined
        : { target: 'pino-pretty', options: { singleLine: true } },
      // Never log credentials or bearer tokens.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
        ],
        remove: true,
      },
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    },
  };
}
