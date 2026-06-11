import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEAM_CODES = [
  'Cipher', 'SideQuest', 'Falcon', 'Breadcrumb', 'Echo',
  'Maverick', 'PlotTwist', 'Nexus', 'Shadow', 'Compass',
  'Wildcard', 'Phoenix', 'Drift', 'AgentX', 'Summit',
  'ChaosCo', 'Vector', 'Scout', 'Quantum', 'Treasure',
  'Rogue', 'Spark', 'Vortex', 'Quest', 'Atlas',
]

async function main() {
  console.log('Seeding database...')

  await prisma.gameState.upsert({
    where: { id: 'game' },
    update: {},
    create: { id: 'game', isPublished: false },
  })

  for (const code of TEAM_CODES) {
    await prisma.team.upsert({
      where: { code },
      update: {},
      create: { code },
    })
  }

  console.log(`✓ Created ${TEAM_CODES.length} teams: ${TEAM_CODES.join(', ')}`)
  console.log('✓ Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
