import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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
}
