import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const formData = await req.formData()

  const title = formData.get('title') as string
  const question = formData.get('question') as string
  const answer = formData.get('answer') as string
  const icon = (formData.get('icon') as string) || '🔍'
  const isFinal = formData.get('isFinal') === 'true'
  const linksJson = formData.get('links') as string
  const imageFile = formData.get('image') as File | null
  const removeImage = formData.get('removeImage') === 'true'

  if (!title || !question || !answer) {
    return NextResponse.json({ error: 'Title, question, and answer are required' }, { status: 400 })
  }

  // Resolve imageData
  let imageData: string | null | undefined = undefined // undefined = don't change
  if (removeImage) {
    imageData = null
  } else if (imageFile && imageFile.size > 0) {
    const buffer = await imageFile.arrayBuffer()
    imageData = `data:${imageFile.type};base64,${Buffer.from(buffer).toString('base64')}`
  }

  const links: Array<{ url: string; buttonText: string }> = linksJson
    ? JSON.parse(linksJson)
    : []

  // Replace links wholesale
  await prisma.challengeLink.deleteMany({ where: { challengeId: id } })

  const challenge = await prisma.challenge.update({
    where: { id },
    data: {
      title,
      question,
      answer,
      icon,
      isFinal,
      ...(imageData !== undefined ? { imageData } : {}),
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

  return NextResponse.json(challenge)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.challenge.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
