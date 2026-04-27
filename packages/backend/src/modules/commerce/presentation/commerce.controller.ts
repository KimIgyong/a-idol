import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  PurchaseProductDto,
  PurchaseTransactionDto,
} from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import { ListProductsUseCase } from '../application/list-products.usecase';
import { CreatePurchaseUseCase } from '../application/create-purchase.usecase';
import { ListMyTransactionsUseCase } from '../application/list-my-transactions.usecase';
import { CreatePurchaseBody } from './dto/commerce.dto';
import { toProductDto, toTransactionDto } from './dto/commerce-view';

/**
 * Weak ETag for /commerce/products — dataset churn is low (catalog edits are
 * occasional admin actions), so hit ratio is expected to be much higher than
 * /idols. Same composition pattern: count + max(updatedAt) + filter shape.
 */
function buildProductsEtag(
  identity: { total: number; maxUpdatedAt: Date | null },
  activeOnly: boolean,
): string {
  const stamp = identity.maxUpdatedAt ? identity.maxUpdatedAt.getTime() : 0;
  return `W/"products-${identity.total}-${stamp}-a${activeOnly ? 1 : 0}"`;
}

@ApiTags('commerce')
@Controller()
export class CommerceController {
  constructor(
    private readonly list: ListProductsUseCase,
    private readonly purchase: CreatePurchaseUseCase,
    private readonly myTxs: ListMyTransactionsUseCase,
  ) {}

  @Get('commerce/products')
  @ApiOperation({ summary: 'Active product catalog (public)' })
  async getProducts(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PurchaseProductDto[] | undefined> {
    const identity = await this.list.getIdentity({ activeOnly: true });
    const etag = buildProductsEtag(identity, /* activeOnly */ true);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }

    const rows = await this.list.execute({ activeOnly: true });
    return rows.map(toProductDto);
  }

  @Post('commerce/purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Start (and, for DEV_SANDBOX, complete) a purchase' })
  async postPurchase(
    @CurrentUser() user: CurrentUserContext,
    @Body() body: CreatePurchaseBody,
  ): Promise<PurchaseTransactionDto> {
    const tx = await this.purchase.execute({
      userId: user.id,
      productId: body.productId,
      provider: body.provider,
      providerTxId: body.providerTxId,
      receiptJws: body.receiptJws,
    });
    return toTransactionDto(tx);
  }

  @Get('me/purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My purchase history (most recent first)' })
  async getMine(
    @CurrentUser() user: CurrentUserContext,
  ): Promise<PurchaseTransactionDto[]> {
    const rows = await this.myTxs.execute(user.id, 50);
    return rows.map(toTransactionDto);
  }
}
