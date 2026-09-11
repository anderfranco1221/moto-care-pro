import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServiceSupplyDto {
  @IsUUID()
  supplyId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateServiceDto {
  @IsUUID()
  motorcycleId!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  /** ISO date string; defaults to now() in the schema when omitted. */
  @IsOptional()
  @IsDateString()
  performedAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mechanic?: string;

  /** Supplies consumed by this service — each one is deducted from stock. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceSupplyDto)
  supplies?: ServiceSupplyDto[];
}
