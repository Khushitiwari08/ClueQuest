import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; challengeId: string }> }
) {
  const { code, challengeId } = await params

  const team = await prisma.team.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  })
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify this challenge is assigned to this team
  const assignment = await prisma.challengeAssignment.findFirst({
    where: { teamId: team.id, challengeId },
    include: { challenge: { select: { imageData: true } } },
  })
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(
    { imageData: assignment.challenge.imageData },
    { headers: { 'Cache-Control': 'public, max-age=3600, immutable' } }
  )
}
