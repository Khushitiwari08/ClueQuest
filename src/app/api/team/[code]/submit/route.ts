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

  // Round trip 1: fetch team + assignment in parallel
  const [team, assignment] = await Promise.all([
    prisma.team.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    }),
    prisma.challengeAssignment.findUnique({
      where: { id: assignmentId },
      include: { challenge: true },
    }),
  ])

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
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

  if (!isCorrect) {
    // Fire-and-forget — wrong answer recording doesn't block the response
    prisma.submission.create({
      data: { teamId: team.id, challengeId: assignment.challengeId, answer: answer.trim(), isCorrect: false },
    }).catch(() => {})
    return NextResponse.json({ correct: false })
  }

  // Round trip 2 (parallel): get rank from Redis + fetch next assignment + record submission
  const nextPosition = assignment.position + 1
  const [rank, nextAssignment] = await Promise.all([
    redis.incr(challengeSolveKey(assignment.challengeId)),
    prisma.challengeAssignment.findUnique({
      where: { teamId_position: { teamId: team.id, position: nextPosition } },
    }),
    prisma.submission.create({
      data: { teamId: team.id, challengeId: assignment.challengeId, answer: answer.trim(), isCorrect: true },
    }),
  ])

  const points = pointsForRank(rank)
  const now = new Date()
  const nextUnlocked = !!nextAssignment

  // Round trip 3 (parallel): all DB writes at once
  await Promise.all([
    prisma.challengeAssignment.update({
      where: { id: assignment.id },
      data: { isCompleted: true, completedAt: now, pointsEarned: points },
    }),
    prisma.team.update({
      where: { id: team.id },
      data: {
        totalPoints: { increment: points },
        ...(nextUnlocked ? {} : { finishedAt: now }),
      },
    }),
    nextAssignment
      ? prisma.challengeAssignment.update({
          where: { id: nextAssignment.id },
          data: { isUnlocked: true },
        })
      : Promise.resolve(),
  ])

  // Ably fire-and-forget — response returns without waiting
  const newTotal = team.totalPoints + points
  Promise.all([
    publishEvent(CHANNELS.team(team.code), 'challenge:completed', {
      assignmentId, position: assignment.position, points, nextUnlocked,
    }),
    publishEvent(CHANNELS.leaderboard, 'leaderboard:update', {
      code: team.code, totalPoints: newTotal, completedPosition: assignment.position,
    }),
  ]).catch(() => {})

  return NextResponse.json({ correct: true, points, rank, nextUnlocked })
}
