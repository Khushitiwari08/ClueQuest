import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const envCheck = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    ABLY_API_KEY: !!process.env.ABLY_API_KEY,
    NEXT_PUBLIC_ABLY_API_KEY: !!process.env.NEXT_PUBLIC_ABLY_API_KEY,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  }

  // Show first 60 chars of DATABASE_URL (no password) to diagnose format issues
  const rawUrl = process.env.DATABASE_URL ?? ''
  const safeUrl = rawUrl.replace(/:([^@]+)@/, ':<hidden>@').slice(0, 80)

  let dbStatus = 'ok'
  let dbError: string | null = null
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    dbStatus = 'error'
    dbError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({ env: envCheck, dbUrlPreview: safeUrl, db: { status: dbStatus, error: dbError } })
}
