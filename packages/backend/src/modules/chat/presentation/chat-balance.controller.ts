import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ChatBalanceDto } from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import { GetChatBalanceUseCase } from '../application/get-chat-balance.usecase';

@ApiTags('chat')
@Controller('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatBalanceController {
  constructor(private readonly balance: GetChatBalanceUseCase) {}

  @Get('chat-balance')
  @ApiOperation({ summary: "Today's remaining free quota + coupon wallet balance" })
  async getBalance(@CurrentUser() user: CurrentUserContext): Promise<ChatBalanceDto> {
    const b = await this.balance.execute(user.id);
    return {
      dailyLimit: b.dailyLimit,
      messagesToday: b.messagesToday,
      remainingFreeMessages: b.remainingFreeMessages,
      couponBalance: b.couponBalance,
      nextResetAt: b.nextResetAt.toISOString(),
    };
  }
}
