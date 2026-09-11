import { loggerOptions } from './logger.config';

describe('loggerOptions', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('uses pino-pretty and debug level in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOG_LEVEL;

    const { pinoHttp } = loggerOptions() as {
      pinoHttp: { level: string; transport?: { target: string } };
    };
    expect(pinoHttp.level).toBe('debug');
    expect(pinoHttp.transport?.target).toBe('pino-pretty');
  });

  it('emits plain JSON (no transport) at info level in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_LEVEL;

    const { pinoHttp } = loggerOptions() as {
      pinoHttp: { level: string; transport?: unknown };
    };
    expect(pinoHttp.level).toBe('info');
    expect(pinoHttp.transport).toBeUndefined();
  });

  it('honours LOG_LEVEL when set', () => {
    process.env.LOG_LEVEL = 'silent';
    const { pinoHttp } = loggerOptions() as { pinoHttp: { level: string } };
    expect(pinoHttp.level).toBe('silent');
  });

  it('redacts the authorization header', () => {
    const { pinoHttp } = loggerOptions() as {
      pinoHttp: { redact: { paths: string[] } };
    };
    expect(pinoHttp.redact.paths).toContain('req.headers.authorization');
  });
});
