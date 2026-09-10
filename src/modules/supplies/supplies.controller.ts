import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { RegisterMovementDto } from './dto/register-movement.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';

@Controller('supplies')
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  create(@Body() createSupplyDto: CreateSupplyDto) {
    return this.suppliesService.create(createSupplyDto);
  }

  @Get()
  findAll() {
    return this.suppliesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplyDto: UpdateSupplyDto,
  ) {
    return this.suppliesService.update(id, updateSupplyDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliesService.remove(id);
  }

  @Get(':id/movements')
  listMovements(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliesService.listMovements(id);
  }

  @Post(':id/movements')
  registerMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() registerMovementDto: RegisterMovementDto,
  ) {
    return this.suppliesService.registerMovement(id, registerMovementDto);
  }
}
