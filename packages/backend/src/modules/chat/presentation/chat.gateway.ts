import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { ChatMessageDto } from '@a-idol/shared';
import { JwtTokenService } from '../../identity/infrastructure/jwt-token.service';
import { OpenRoomUseCase } from '../application/open-room.usecase';
import { SendMessageUseCase } from '../application/send-message.usecase';
import { ListMessagesUseCase } from '../application/list-messages.usecase';
import { toChatMessageDto } from './dto/chat-view';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

/**
 * WebSocket gateway for 1:1 idol chat.
 *
 * Auth: socket.handshake.auth.token (or `?token=…`) must be a valid user
 *   access JWT (not an admin token).
 *
 * Events (client → server):
 *   - `room:open`    { idolId }                       → `room:opened` { roomId }
 *   - `room:join`    { roomId }                        → `room:joined` { roomId, history: [] }
 *   - `message:send` { roomId, content }               → both user + idol messages emitted via `message:received`
 *
 * Events (server → client):
 *   - `message:received` ChatMessageDto  (broadcast into a `room:<id>` socket.io room)
 *   - `error:chat`       { code, message }
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtTokenService,
    private readonly open: OpenRoomUseCase,
    private readonly send: SendMessageUseCase,
    private readonly list: ListMessagesUseCase,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string } | undefined)?.token ??
        (client.handshake.query?.token as string | undefined);
      if (!token) throw new UnauthorizedException('Missing token');
      const payload = await this.jwt.verifyAccess(token);
      (client as AuthedSocket).data = { userId: payload.sub };
    } catch (err) {
      this.log.warn(`WS auth failed: ${(err as Error).message}`);
      client.emit('error:chat', { code: 'UNAUTHORIZED', message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.log.debug(`ws disconnect ${client.id}`);
  }

  @SubscribeMessage('room:open')
  async onOpen(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { idolId?: string },
  ): Promise<{ roomId: string } | { code: string; message: string }> {
    if (!body?.idolId) return { code: 'BAD_REQUEST', message: 'idolId required' };
    try {
      const room = await this.open.execute({
        userId: client.data.userId,
        idolId: body.idolId,
      });
      return { roomId: room.id };
    } catch (err) {
      return this.toWireError(err);
    }
  }

  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId?: string },
  ): Promise<{ roomId: string; history: ChatMessageDto[] } | { code: string; message: string }> {
    if (!body?.roomId) return { code: 'BAD_REQUEST', message: 'roomId required' };
    try {
      const history = await this.list.execute({
        userId: client.data.userId,
        roomId: body.roomId,
        take: 50,
      });
      await client.join(this.roomKey(body.roomId));
      return { roomId: body.roomId, history: history.map(toChatMessageDto) };
    } catch (err) {
      return this.toWireError(err);
    }
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId?: string; content?: string },
  ): Promise<{ ok: true } | { code: string; message: string }> {
    if (!body?.roomId || !body.content) {
      return { code: 'BAD_REQUEST', message: 'roomId and content required' };
    }
    try {
      const res = await this.send.execute({
        userId: client.data.userId,
        roomId: body.roomId,
        content: body.content,
      });
      this.broadcastMessage(body.roomId, toChatMessageDto(res.userMessage));
      this.broadcastMessage(body.roomId, toChatMessageDto(res.idolReply));
      return { ok: true };
    } catch (err) {
      return this.toWireError(err);
    }
  }

  /** Used by the REST controller when a client sent via HTTP fallback. */
  broadcastMessage(roomId: string, msg: ChatMessageDto): void {
    this.server?.to(this.roomKey(roomId)).emit('message:received', msg);
  }

  private roomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  private toWireError(err: unknown): { code: string; message: string } {
    const e = err as { code?: string; message?: string };
    return {
      code: e.code ?? 'CHAT_ERROR',
      message: e.message ?? 'Unexpected error',
    };
  }
}
