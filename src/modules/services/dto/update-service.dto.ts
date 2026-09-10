import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateServiceDto } from './create-service.dto';

// `supplies` is create-only: reversing already-recorded stock movements on
// an update is out of scope. Register a corrective movement instead.
export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ['supplies'] as const),
) {}
