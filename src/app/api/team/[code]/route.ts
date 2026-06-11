import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const team = await prisma.team.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  })
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const gameState = await prisma.gameState.findUnique({ where: { id: 'game' } })

  const teamCode = team.code

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
      code: teamCode,
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
