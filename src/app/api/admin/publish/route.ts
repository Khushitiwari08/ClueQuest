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

  const [gameState, allChallenges, teams] = await Promise.all([
    prisma.gameState.findUnique({ where: { id: 'game' } }),
    prisma.challenge.findMany(),
    prisma.team.findMany(),
  ])

  if (gameState?.isPublished) {
    return NextResponse.json({ error: 'Game already published' }, { status: 400 })
  }

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

  // Build ALL assignments for all teams in memory first, then insert in one shot
  const allAssignments = teams.flatMap((team) => {
    const picked = shuffle(regular).slice(0, 4)
    return [
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
  })

  const now = new Date()

  // Flush Redis counters + wipe old assignments + write new state — all in parallel
  await Promise.all([
    // Redis: delete all solve counters in parallel
    Promise.all(allChallenges.map((c) => redis.del(challengeSolveKey(c.id)))),
    // DB: wipe old assignments
    prisma.challengeAssignment.deleteMany(),
  ])

  // Insert all assignments + update game/team state in parallel
  await Promise.all([
    prisma.challengeAssignment.createMany({ data: allAssignments }),
    prisma.gameState.update({
      where: { id: 'game' },
      data: { isPublished: true, publishedAt: now },
    }),
    prisma.team.updateMany({
      data: { totalPoints: 0, startedAt: now, finishedAt: null },
    }),
  ])

  // Fire Ably after DB is settled (non-blocking on response)
  publishEvent(CHANNELS.gameEvents, 'game:published', { publishedAt: now.toISOString() }).catch(() => {})

  return NextResponse.json({ ok: true, teamsAssigned: teams.length })
}
