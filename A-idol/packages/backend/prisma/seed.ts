/**
 * Minimal seed for local development.
 * Creates 1 agency + 3 sample idols + 3 fan clubs. Run with `pnpm seed`.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  seeding…');

  const agency = await prisma.agency.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'A-idol Agency',
      description: 'House agency that manages all 99 idols (MVP).',
    },
  });

  const idolSeeds = [
    { id: '00000000-0000-0000-0000-0000000000a1', name: 'Aria', mbti: 'ENFP', bio: 'The warm voice of A-idol.' },
    { id: '00000000-0000-0000-0000-0000000000a2', name: 'Bina', mbti: 'INTJ', bio: 'Strategic dancer, fearless on stage.' },
    { id: '00000000-0000-0000-0000-0000000000a3', name: 'Caleb', mbti: 'ESFP', bio: 'Charismatic main rapper.' },
  ];

  for (const s of idolSeeds) {
    await prisma.idol.upsert({
      where: { id: s.id },
      update: { name: s.name, mbti: s.mbti, bio: s.bio, publishedAt: new Date() },
      create: {
        id: s.id,
        name: s.name,
        stageName: s.name,
        mbti: s.mbti,
        bio: s.bio,
        agencyId: agency.id,
        publishedAt: new Date(),
        fanClub: { create: { tier: 'official', price: 0 } },
      },
    });
  }

  const totalIdols = await prisma.idol.count();
  const totalClubs = await prisma.fanClub.count();
  console.log(`✅ seeded: ${totalIdols} idols, ${totalClubs} fan clubs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
