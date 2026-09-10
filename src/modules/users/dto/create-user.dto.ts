import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Nombre del taller — crea un Tenant nuevo al registrarse (ver AuthService.register). */
  @IsString()
  @IsNotEmpty()
  tenantName!: string;
}
