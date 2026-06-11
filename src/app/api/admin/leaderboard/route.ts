import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gameState = await prisma.gameState.findUnique({ where: { id: 'game' } })

  const teams = await prisma.team.findMany({
    include: {
      assignments: {
        where: { isCompleted: true },
        orderBy: { completedAt: 'desc' },
      },
    },
    orderBy: [{ totalPoints: 'desc' }],
  })

  const leaderboard = teams.map((team, idx) => {
    const completedCount = team.assignments.length
    const lastCompleted = team.assignments[0]?.completedAt
    const startTime = team.startedAt ?? gameState?.publishedAt
    const timeTakenMs =
      completedCount > 0 && startTime && lastCompleted
        ? lastCompleted.getTime() - startTime.getTime()
        : null

    return {
      rank: idx + 1,
      code: team.code,
      totalPoints: team.totalPoints,
      completedCount,
      timeTakenMs,
      finishedAt: team.finishedAt?.toISOString() ?? null,
    }
  })

  // Re-rank by points desc, then completedCount desc, then timeTakenMs asc
  leaderboard.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount
    if (a.timeTakenMs !== null && b.timeTakenMs !== null) return a.timeTakenMs - b.timeTakenMs
    return 0
  })

  leaderboard.forEach((e, i) => (e.rank = i + 1))

  return NextResponse.json({ leaderboard, isPublished: gameState?.isPublished ?? false })
}
