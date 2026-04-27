import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ChatRoom } from '../domain/chat-room';
import type { ChatRoomRepository } from '../application/interfaces';

type RoomRow = {
  id: string;
  userId: string;
  idolId: string;
  createdAt: Date;
  lastMessageAt: Date | null;
};

@Injectable()
export class PrismaChatRoomRepository implements ChatRoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndIdol(userId: string, idolId: string): Promise<ChatRoom | null> {
    const row = await this.prisma.chatRoom.findUnique({
      where: { userId_idolId: { userId, idolId } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<ChatRoom | null> {
    const row = await this.prisma.chatRoom.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async upsertOpen(userId: string, idolId: string): Promise<ChatRoom> {
    const row = await this.prisma.chatRoom.upsert({
      where: { userId_idolId: { userId, idolId } },
      update: {},
      create: { userId, idolId },
    });
    return this.toDomain(row);
  }

  async listByUser(
    userId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: ChatRoom[]; total: number }> {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.chatRoom.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: opts.take,
        skip: opts.skip,
      }),
      this.prisma.chatRoom.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async touchLastMessage(roomId: string, at: Date): Promise<void> {
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: at },
    });
  }

  private toDomain(r: RoomRow): ChatRoom {
    return ChatRoom.create({
      id: r.id,
      userId: r.userId,
      idolId: r.idolId,
      createdAt: r.createdAt,
      lastMessageAt: r.lastMessageAt,
    });
  }
}
