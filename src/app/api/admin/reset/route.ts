import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { publishEvent, CHANNELS } from '@/lib/ably'

export async function POST() {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.challengeAssignment.deleteMany()
  await prisma.submission.deleteMany()
  await prisma.team.updateMany({
    data: { totalPoints: 0, startedAt: null, finishedAt: null },
  })
  await prisma.gameState.update({
    where: { id: 'game' },
    data: { isPublished: false, publishedAt: null },
  })

  await publishEvent(CHANNELS.gameEvents, 'game:reset', {})

  return NextResponse.json({ ok: true })
}
