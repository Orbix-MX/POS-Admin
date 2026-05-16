import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BulkUpdateInventoryDto, TransferStockDto } from './dto/update-inventory.dto';
import { RequirePlanGuard, RequirePlan } from '../../../common/guards/require-plan.guard';
import { RequireModule } from '../../../common/guards/require-module.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@RequireModule('branches')
@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(RequirePlanGuard)
@RequirePlan('PLUS', 'ENTERPRISE')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermissions('branches:manage')
  @ApiOperation({ summary: 'Create a branch (PLUS+)' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get()
  @RequirePermissions('branches:view')
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('branches:view')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('branches:manage')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('branches:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }

  @Patch(':id/set-main')
  @RequirePermissions('branches:manage')
  setMain(@Param('id') id: string) {
    return this.branchesService.setMain(id);
  }

  // ── Members ──────────────────────────────────────────────────────────────

  @Post(':id/members/:userId')
  @RequirePermissions('branches:manage')
  addMember(
    @Param('id') branchId: string,
    @Param('userId') userId: string,
    @Body('isPrimary') isPrimary?: boolean,
  ) {
    return this.branchesService.addMember(branchId, userId, isPrimary);
  }

  @Delete(':id/members/:userId')
  @RequirePermissions('branches:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(@Param('id') branchId: string, @Param('userId') userId: string) {
    return this.branchesService.removeMember(branchId, userId);
  }

  // ── Inventory ─────────────────────────────────────────────────────────────

  @Get(':id/inventory')
  @RequirePermissions('branches:view')
  @ApiOperation({ summary: 'Get full inventory for a branch' })
  getInventory(@Param('id') id: string) {
    return this.branchesService.getInventory(id);
  }

  @Patch(':id/inventory/:productId')
  @RequirePermissions('branches:inventory')
  @ApiOperation({ summary: 'Update stock for one product in this branch' })
  updateInventoryItem(
    @Param('id') branchId: string,
    @Param('productId') productId: string,
    @Body('stock') stock: number,
  ) {
    return this.branchesService.updateInventoryItem(branchId, productId, stock);
  }

  @Post(':id/inventory/bulk')
  @RequirePermissions('branches:inventory')
  @ApiOperation({ summary: 'Bulk update inventory for this branch' })
  bulkUpdateInventory(@Param('id') branchId: string, @Body() dto: BulkUpdateInventoryDto) {
    return this.branchesService.bulkUpdateInventory(branchId, dto);
  }

  @Post(':id/inventory/transfer')
  @RequirePermissions('branches:inventory')
  @ApiOperation({ summary: 'Transfer stock from this branch to another' })
  transferStock(@Param('id') fromBranchId: string, @Body() dto: TransferStockDto) {
    return this.branchesService.transferStock(fromBranchId, dto);
  }
}
