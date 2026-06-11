import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  // Fetch team, gameState, and assignments in parallel
  const [team, gameState] = await Promise.all([
    prisma.team.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    }),
    prisma.gameState.findUnique({ where: { id: 'game' } }),
  ])

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const assignments = await prisma.challengeAssignment.findMany({
    where: { teamId: team.id },
    include: {
      challenge: {
        include: { links: { orderBy: { order: 'asc' } } },
      },
    },
    orderBy: { position: 'asc' },
  })

  return NextResponse.json({
    team: {
      code: team.code,
      totalPoints: team.totalPoints,
      startedAt: team.startedAt?.toISOString() ?? null,
      finishedAt: team.finishedAt?.toISOString() ?? null,
    },
    gameState: {
      isPublished: gameState?.isPublished ?? false,
      publishedAt: gameState?.publishedAt?.toISOString() ?? null,
    },
    challenges: assignments.map((a) => ({
      id: a.id,
      position: a.position,
      isUnlocked: a.isUnlocked,
      isCompleted: a.isCompleted,
      completedAt: a.completedAt?.toISOString() ?? null,
      pointsEarned: a.pointsEarned,
      challenge: {
        id: a.challenge.id,
        title: a.challenge.title,
        question: a.challenge.question,
        imageData: a.challenge.imageData,
        isFinal: a.challenge.isFinal,
        icon: a.challenge.icon,
        answerLength: a.challenge.answer.replace(/\s/g, '').length,
        links: a.challenge.links.map((l) => ({
          id: l.id,
          url: l.url,
          buttonText: l.buttonText,
          order: l.order,
        })),
      },
    })),
  })
}
