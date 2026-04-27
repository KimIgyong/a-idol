import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  FanClubRecord,
  FanClubRepository,
  MembershipRecord,
} from '../application/interfaces';

type FanClubRow = {
  id: string;
  idolId: string;
  tier: string;
  price: { toNumber: () => number } | number;
  createdAt: Date;
};

@Injectable()
export class PrismaFanClubRepository implements FanClubRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdol(idolId: string): Promise<FanClubRecord | null> {
    const fc = await this.prisma.fanClub.findUnique({ where: { idolId } });
    if (!fc) return null;
    const memberCount = await this.prisma.membership.count({
      where: { fanClubId: fc.id, leftAt: null },
    });
    return this.toRecord(fc, idolId, memberCount);
  }

  async findMembership(userId: string, idolId: string): Promise<MembershipRecord | null> {
    const row = await this.prisma.membership.findFirst({
      where: { userId, fanClub: { idolId } },
      include: { fanClub: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      fanClubId: row.fanClubId,
      idolId,
      userId: row.userId,
      tier: row.fanClub.tier,
      joinedAt: row.joinedAt,
      leftAt: row.leftAt,
    };
  }

  async join(userId: string, fanClubId: string): Promise<MembershipRecord> {
    // Upsert on (userId, fanClubId) — existing left membership gets leftAt cleared
    // and joinedAt refreshed, so re-joining still shows up in "my recent fan clubs".
    const row = await this.prisma.membership.upsert({
      where: { userId_fanClubId: { userId, fanClubId } },
      update: { leftAt: null, joinedAt: new Date() },
      create: { userId, fanClubId },
      include: { fanClub: true },
    });
    return {
      id: row.id,
      fanClubId: row.fanClubId,
      idolId: row.fanClub.idolId,
      userId: row.userId,
      tier: row.fanClub.tier,
      joinedAt: row.joinedAt,
      leftAt: row.leftAt,
    };
  }

  async leave(userId: string, fanClubId: string): Promise<MembershipRecord | null> {
    // No-op if the user is not currently an active member.
    const active = await this.prisma.membership.findFirst({
      where: { userId, fanClubId, leftAt: null },
    });
    if (!active) return null;
    const row = await this.prisma.membership.update({
      where: { id: active.id },
      data: { leftAt: new Date() },
      include: { fanClub: true },
    });
    return {
      id: row.id,
      fanClubId: row.fanClubId,
      idolId: row.fanClub.idolId,
      userId: row.userId,
      tier: row.fanClub.tier,
      joinedAt: row.joinedAt,
      leftAt: row.leftAt,
    };
  }

  async listMyMemberships(
    userId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: MembershipRecord[]; total: number }> {
    const where = { userId, leftAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        include: { fanClub: true },
        orderBy: { joinedAt: 'desc' },
        take: opts.take,
        skip: opts.skip,
      }),
      this.prisma.membership.count({ where }),
    ]);
    const items: MembershipRecord[] = rows.map((r) => ({
      id: r.id,
      fanClubId: r.fanClubId,
      idolId: r.fanClub.idolId,
      userId: r.userId,
      tier: r.fanClub.tier,
      joinedAt: r.joinedAt,
      leftAt: r.leftAt,
    }));
    return { items, total };
  }

  private toRecord(fc: FanClubRow, idolId: string, memberCount: number): FanClubRecord {
    const price =
      typeof fc.price === 'number' ? fc.price : fc.price.toNumber();
    return {
      id: fc.id,
      idolId,
      tier: fc.tier,
      price,
      memberCount,
      createdAt: fc.createdAt,
    };
  }
}
