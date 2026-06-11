import { NextRequest, NextResponse } from 'next/server'
import Ably from 'ably'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId') || 'anonymous'

  const client = new Ably.Rest(process.env.ABLY_API_KEY!)
  const tokenRequest = await client.auth.createTokenRequest({ clientId })

  return NextResponse.json(tokenRequest)
}
