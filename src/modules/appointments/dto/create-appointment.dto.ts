import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  motorcycleId!: string;

  /** ISO date string — when the motorcycle is expected at the workshop. */
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
