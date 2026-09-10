import { MovementType } from '@prisma-tenant/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RegisterMovementDto {
  @IsEnum(MovementType)
  type!: MovementType;

  /** Always positive — `type` decides whether it adds to or removes from stock. */
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
