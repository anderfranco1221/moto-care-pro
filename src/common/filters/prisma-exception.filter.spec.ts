import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma-tenant/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

const hostReturning = (json: jest.Mock, status: jest.Mock): ArgumentsHost =>
  ({
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  }) as unknown as ArgumentsHost;

const knownError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta,
  });

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
  });

  it('maps P2025 (missing record) to 404', () => {
    filter.catch(knownError('P2025'), hostReturning(json, status));
    expect(status).toHaveBeenCalledWith(404);
  });

  it('maps P2002 (unique clash) to 409 and names the field', () => {
    filter.catch(
      knownError('P2002', { target: ['sku'] }),
      hostReturning(json, status),
    );
    expect(status).toHaveBeenCalledWith(409);
    const [payload] = json.mock.calls[0] as [{ message: string }];
    expect(payload.message).toContain('sku');
  });

  it('maps P2003 (bad foreign key) to 422', () => {
    filter.catch(knownError('P2003'), hostReturning(json, status));
    expect(status).toHaveBeenCalledWith(422);
  });

  it('leaves an unmapped code as 500', () => {
    filter.catch(knownError('P2016'), hostReturning(json, status));
    expect(status).toHaveBeenCalledWith(500);
  });
});
