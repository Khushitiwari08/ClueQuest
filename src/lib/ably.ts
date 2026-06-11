import Ably from 'ably'

let _server: Ably.Rest | null = null

export function getAblyServer(): Ably.Rest {
  if (!_server) {
    _server = new Ably.Rest(process.env.ABLY_API_KEY!)
  }
  return _server
}

export async function publishEvent(channel: string, event: string, data: unknown) {
  try {
    const server = getAblyServer()
    await server.channels.get(channel).publish(event, data)
  } catch (err) {
    console.error('Ably publish error:', err)
  }
}

export const CHANNELS = {
  leaderboard: 'leaderboard',
  gameEvents: 'game-events',
  team: (code: string) => `team-${code}`,
}
