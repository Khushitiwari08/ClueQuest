import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const challenges = await prisma.challenge.findMany({
    include: { links: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(challenges)
}

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const title = formData.get('title') as string
  const question = formData.get('question') as string
  const answer = formData.get('answer') as string
  const icon = (formData.get('icon') as string) || '🔍'
  const isFinal = formData.get('isFinal') === 'true'
  const linksJson = formData.get('links') as string
  const imageFile = formData.get('image') as File | null

  if (!title || !question || !answer) {
    return NextResponse.json({ error: 'Title, question, and answer are required' }, { status: 400 })
  }

  let imageData: string | null = null
  if (imageFile && imageFile.size > 0) {
    const buffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    imageData = `data:${imageFile.type};base64,${base64}`
  }

  const links: Array<{ url: string; buttonText: string; order: number }> = linksJson
    ? JSON.parse(linksJson)
    : []

  const challenge = await prisma.challenge.create({
    data: {
      title,
      question,
      answer,
      icon,
      isFinal,
      imageData,
      links: {
        create: links.map((l, i) => ({
          url: l.url,
          buttonText: l.buttonText,
          order: i,
        })),
      },
    },
    include: { links: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(challenge, { status: 201 })
}
