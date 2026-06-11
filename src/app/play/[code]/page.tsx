import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import TeamDashboard from '@/components/game/TeamDashboard'

export default async function PlayPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const team = await prisma.team.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  })
  if (!team) notFound()

  return <TeamDashboard teamCode={team.code} />
}
