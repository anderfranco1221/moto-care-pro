import { NotFoundException } from '@nestjs/common';

/** Turns a `findUnique`/`findFirst` miss (null) into a 404. */
export function orNotFound<T>(row: T | null, entity: string): T {
  if (row === null) {
    throw new NotFoundException(`${entity} not found`);
  }
  return row;
}
