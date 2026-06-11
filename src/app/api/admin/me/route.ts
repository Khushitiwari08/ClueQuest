import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'

export async function GET() {
  const isAdmin = await getAdminSession()
  if (!isAdmin) return NextResponse.json({ authenticated: false }, { status: 401 })
  return NextResponse.json({ authenticated: true })
}
