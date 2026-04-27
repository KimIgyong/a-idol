import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { ChatMembershipChecker } from '../application/interfaces';

@Injectable()
export class PrismaMembershipChecker implements ChatMembershipChecker {
  constructor(private readonly prisma: PrismaService) {}

  async isActiveMember(userId: string, idolId: string): Promise<boolean> {
    // Walk through Fandom without depending on its Prisma model shape.
    const match = await this.prisma.membership.findFirst({
      where: {
        userId,
        leftAt: null,
        fanClub: { idolId },
      },
      select: { id: true },
    });
    return !!match;
  }
}
