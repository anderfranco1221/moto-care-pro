import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma-tenant/client';
import { Response } from 'express';

/**
 * Maps the Prisma errors the domain modules can surface to the right HTTP
 * status, so a controller doesn't 500 on an expected condition (a stale id,
 * a duplicate sku, a bad foreign key). Unmapped Prisma codes stay a 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttpException(exception);
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttpException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): HttpException {
    switch (exception.code) {
      case 'P2025': // record required by the operation was not found
        return new NotFoundException('Resource not found');
      case 'P2002': {
        // unique constraint failed
        const target = (exception.meta?.target as string[] | undefined)?.join(
          ', ',
        );
        return new ConflictException(
          target
            ? `A record with this ${target} already exists`
            : 'Duplicate value',
        );
      }
      case 'P2003': // foreign key constraint failed
        return new UnprocessableEntityException(
          'Referenced record does not exist',
        );
      default:
        return new InternalServerErrorException();
    }
  }
}
