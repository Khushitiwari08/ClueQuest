import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis, challengeSolveKey, pointsForRank } from '@/lib/redis'
import { publishEvent, CHANNELS } from '@/lib/ably'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const { assignmentId, answer } = await req.json()

  if (!assignmentId || !answer) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const team = await prisma.team.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  })
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const upperCode = team.code

  const assignment = await prisma.challengeAssignment.findUnique({
    where: { id: assignmentId },
    include: { challenge: true },
  })

  if (!assignment || assignment.teamId !== team.id) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  if (!assignment.isUnlocked) {
    return NextResponse.json({ error: 'Challenge is locked' }, { status: 403 })
  }

  if (assignment.isCompleted) {
    return NextResponse.json({ correct: true, alreadyCompleted: true })
  }

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s/g, '')
  const isCorrect = normalize(answer) === normalize(assignment.challenge.answer)

  await prisma.submission.create({
    data: {
      teamId: team.id,
      challengeId: assignment.challengeId,
      answer: answer.trim(),
      isCorrect,
    },
  })

  if (!isCorrect) {
    return NextResponse.json({ correct: false })
  }

  // Atomic rank determination
  const rank = await redis.incr(challengeSolveKey(assignment.challengeId))
  const points = pointsForRank(rank)
  const now = new Date()

  await prisma.challengeAssignment.update({
    where: { id: assignment.id },
    data: { isCompleted: true, completedAt: now, pointsEarned: points },
  })

  await prisma.team.update({
    where: { id: team.id },
    data: { totalPoints: { increment: points } },
  })

  // Unlock next challenge
  const nextAssignment = await prisma.challengeAssignment.findUnique({
    where: { teamId_position: { teamId: team.id, position: assignment.position + 1 } },
  })

  let nextUnlocked = false
  if (nextAssignment) {
    await prisma.challengeAssignment.update({
      where: { id: nextAssignment.id },
      data: { isUnlocked: true },
    })
    nextUnlocked = true
  } else {
    // All challenges done
    await prisma.team.update({
      where: { id: team.id },
      data: { finishedAt: now },
    })
  }

  const updatedTeam = await prisma.team.findUnique({ where: { id: team.id } })

  await publishEvent(CHANNELS.team(upperCode), 'challenge:completed', {
    assignmentId,
    position: assignment.position,
    points,
    nextUnlocked,
  })

  await publishEvent(CHANNELS.leaderboard, 'leaderboard:update', {
    code: upperCode,
    totalPoints: updatedTeam?.totalPoints ?? 0,
    completedPosition: assignment.position,
  })

  return NextResponse.json({ correct: true, points, rank, nextUnlocked })
}
