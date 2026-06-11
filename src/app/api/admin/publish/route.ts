import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { publishEvent, CHANNELS } from '@/lib/ably'
import { redis, challengeSolveKey } from '@/lib/redis'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST() {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gameState = await prisma.gameState.findUnique({ where: { id: 'game' } })
  if (gameState?.isPublished) {
    return NextResponse.json({ error: 'Game already published' }, { status: 400 })
  }

  const allChallenges = await prisma.challenge.findMany()
  const regular = allChallenges.filter((c) => !c.isFinal)
  const finals = allChallenges.filter((c) => c.isFinal)

  if (regular.length < 4) {
    return NextResponse.json(
      { error: `Need at least 4 regular challenges (have ${regular.length})` },
      { status: 400 }
    )
  }
  if (finals.length === 0) {
    return NextResponse.json({ error: 'Need at least 1 final challenge' }, { status: 400 })
  }

  const finalChallenge = finals[finals.length - 1]
  const teams = await prisma.team.findMany()

  // Reset Redis solve counters
  for (const c of allChallenges) {
    await redis.del(challengeSolveKey(c.id))
  }

  // Delete existing assignments
  await prisma.challengeAssignment.deleteMany()

  // Assign challenges to each team
  for (const team of teams) {
    const picked = shuffle(regular).slice(0, 4)
    const assignments = [
      ...picked.map((c, i) => ({
        teamId: team.id,
        challengeId: c.id,
        position: i + 1,
        isUnlocked: i === 0,
      })),
      {
        teamId: team.id,
        challengeId: finalChallenge.id,
        position: 5,
        isUnlocked: false,
      },
    ]
    await prisma.challengeAssignment.createMany({ data: assignments })
  }

  const now = new Date()
  await prisma.gameState.update({
    where: { id: 'game' },
    data: { isPublished: true, publishedAt: now },
  })

  await prisma.team.updateMany({
    data: { totalPoints: 0, startedAt: now, finishedAt: null },
  })

  await publishEvent(CHANNELS.gameEvents, 'game:published', { publishedAt: now.toISOString() })

  return NextResponse.json({ ok: true, teamsAssigned: teams.length })
}
