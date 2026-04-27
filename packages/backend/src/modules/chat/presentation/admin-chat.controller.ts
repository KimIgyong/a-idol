import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CouponReason } from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { GrantCouponUseCase } from '../application/grant-coupon.usecase';

const ALLOWED_REASONS: CouponReason[] = ['ADMIN_GRANT', 'DAILY_GIFT', 'REFUND'];

class GrantCouponBody {
  @IsInt()
  delta!: number;

  @IsOptional()
  @IsIn(ALLOWED_REASONS)
  reason?: CouponReason;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

@ApiTags('admin-chat')
@Controller('admin/users/:userId/chat-coupons')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminChatController {
  constructor(private readonly grant: GrantCouponUseCase) {}

  @Post('grant')
  @HttpCode(200)
  @ApiOperation({ summary: 'Grant (or deduct) chat coupons for a user' })
  async postGrant(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: GrantCouponBody,
  ) {
    const { wallet, entry } = await this.grant.execute({
      userId,
      delta: body.delta,
      reason: body.reason,
      memo: body.memo,
    });
    return {
      balance: wallet.balance,
      entry: {
        delta: entry.delta,
        reason: entry.reason,
        balanceAfter: entry.balanceAfter,
        memo: entry.memo,
        createdAt: entry.createdAt.toISOString(),
      },
    };
  }
}
