import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export function challengeSolveKey(challengeId: string) {
  return `game:challenge:${challengeId}:solves`
}

const POINTS = [100, 75, 60, 50]

export function pointsForRank(rank: number): number {
  return POINTS[Math.min(rank - 1, POINTS.length - 1)]
}
