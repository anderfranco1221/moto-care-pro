import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateSupplyDto } from './create-supply.dto';

// `stock` is intentionally not updatable here — it only moves through
// POST /supplies/:id/movements, which also records why.
export class UpdateSupplyDto extends PartialType(
  OmitType(CreateSupplyDto, ['stock'] as const),
) {}
