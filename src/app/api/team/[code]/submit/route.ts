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

  // Fetch team and assignment in parallel
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

  // Record submission (fire and don't await — we don't need the result)
  const submissionPromise = prisma.submission.create({
    data: {
      teamId: team.id,
      challengeId: assignment.challengeId,
      answer: answer.trim(),
      isCorrect,
    },
  })

  if (!isCorrect) {
    submissionPromise.catch(() => {}) // best-effort
    return NextResponse.json({ correct: false })
  }

  await submissionPromise

  // Atomic rank + mark completed + add points — all in parallel
  const now = new Date()
  const [rank] = await Promise.all([
    redis.incr(challengeSolveKey(assignment.challengeId)),
    prisma.challengeAssignment.update({
      where: { id: assignment.id },
      data: { isCompleted: true, completedAt: now },
    }),
  ])

  const points = pointsForRank(rank)

  // Update points + find next assignment in parallel
  const [, nextAssignment] = await Promise.all([
    prisma.team.update({
      where: { id: team.id },
      data: { totalPoints: { increment: points } },
    }),
    prisma.challengeAssignment.findUnique({
      where: { teamId_position: { teamId: team.id, position: assignment.position + 1 } },
    }),
  ])

  // Update pointsEarned + unlock next (or mark finished) in parallel
  const unlockOrFinish = nextAssignment
    ? prisma.challengeAssignment.update({
        where: { id: nextAssignment.id },
        data: { isUnlocked: true },
      })
    : prisma.team.update({
        where: { id: team.id },
        data: { finishedAt: now },
      })

  const [updatedTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: team.id } }),
    prisma.challengeAssignment.update({
      where: { id: assignment.id },
      data: { pointsEarned: points },
    }),
    unlockOrFinish,
  ])

  const nextUnlocked = !!nextAssignment

  // Publish Ably events in parallel (non-blocking on response)
  Promise.all([
    publishEvent(CHANNELS.team(team.code), 'challenge:completed', {
      assignmentId,
      position: assignment.position,
      points,
      nextUnlocked,
    }),
    publishEvent(CHANNELS.leaderboard, 'leaderboard:update', {
      code: team.code,
      totalPoints: updatedTeam?.totalPoints ?? 0,
      completedPosition: assignment.position,
    }),
  ]).catch(() => {})

  return NextResponse.json({ correct: true, points, rank, nextUnlocked })
}
