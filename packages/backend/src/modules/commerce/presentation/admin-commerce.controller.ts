import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';
import type { PurchaseProductDto } from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { ListProductsUseCase } from '../application/list-products.usecase';
import {
  CreateProductUseCase,
  UpdateProductUseCase,
} from '../application/manage-products.usecase';
import { CreateProductBody, UpdateProductBody } from './dto/commerce.dto';
import { toProductDto } from './dto/commerce-view';

class ListProductsQuery {
  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}

@ApiTags('admin-commerce')
@Controller('admin/commerce/products')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminCommerceController {
  constructor(
    private readonly list: ListProductsUseCase,
    private readonly create: CreateProductUseCase,
    private readonly updateUc: UpdateProductUseCase,
  ) {}

  @Get()
  async get(@Query() q: ListProductsQuery): Promise<PurchaseProductDto[]> {
    const rows = await this.list.execute({
      activeOnly: q.activeOnly === 'true',
    });
    return rows.map(toProductDto);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create product (admin only)' })
  @Roles('admin')
  async post(@Body() body: CreateProductBody): Promise<PurchaseProductDto> {
    const product = await this.create.execute({
      sku: body.sku,
      kind: body.kind,
      title: body.title,
      description: body.description,
      priceKrw: body.price_krw,
      deliveryPayload: body.delivery_payload,
    });
    return toProductDto(product);
  }

  @Patch(':id')
  async patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProductBody,
  ): Promise<PurchaseProductDto> {
    const product = await this.updateUc.execute(id, {
      title: body.title,
      description: body.description,
      priceKrw: body.price_krw,
      deliveryPayload: body.delivery_payload,
      isActive: body.is_active,
    });
    return toProductDto(product);
  }
}
