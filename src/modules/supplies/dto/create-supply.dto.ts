import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateSupplyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  /** Opening stock; further changes go through POST /supplies/:id/movements. */
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
