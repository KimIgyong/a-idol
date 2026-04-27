import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import type { ChatMessageDto, ChatRoomDto } from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import { OpenRoomUseCase } from '../application/open-room.usecase';
import { SendMessageUseCase } from '../application/send-message.usecase';
import { ListMessagesUseCase } from '../application/list-messages.usecase';
import { SendMessageDto } from './dto/send-message.dto';
import { toChatMessageDto, toChatRoomDto } from './dto/chat-view';
import { ChatGateway } from './chat.gateway';

class ListMessagesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 50;

  @IsOptional()
  @IsISO8601()
  before?: string;
}

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly open: OpenRoomUseCase,
    private readonly send: SendMessageUseCase,
    private readonly list: ListMessagesUseCase,
    private readonly gateway: ChatGateway,
  ) {}

  @Post('rooms/:idolId/open')
  @HttpCode(200)
  @ApiOperation({ summary: 'Open (or get) the 1:1 chat room with this idol' })
  async postOpen(
    @CurrentUser() user: CurrentUserContext,
    @Param('idolId', new ParseUUIDPipe()) idolId: string,
  ): Promise<ChatRoomDto> {
    const room = await this.open.execute({ userId: user.id, idolId });
    return toChatRoomDto(room);
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'List recent messages in a room (chronological asc)' })
  async getMessages(
    @CurrentUser() user: CurrentUserContext,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Query() q: ListMessagesQuery,
  ): Promise<ChatMessageDto[]> {
    const msgs = await this.list.execute({
      userId: user.id,
      roomId,
      take: q.take,
      before: q.before ? new Date(q.before) : undefined,
    });
    return msgs.map(toChatMessageDto);
  }

  @Post('rooms/:roomId/messages')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a message (REST fallback). Returns user + idol reply.' })
  async postMessage(
    @CurrentUser() user: CurrentUserContext,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Body() body: SendMessageDto,
  ): Promise<{ user: ChatMessageDto; idol: ChatMessageDto }> {
    const res = await this.send.execute({
      userId: user.id,
      roomId,
      content: body.content,
    });
    const userDto = toChatMessageDto(res.userMessage);
    const idolDto = toChatMessageDto(res.idolReply);
    // Mirror to any connected sockets watching this room.
    this.gateway.broadcastMessage(roomId, userDto);
    this.gateway.broadcastMessage(roomId, idolDto);
    return { user: userDto, idol: idolDto };
  }
}
