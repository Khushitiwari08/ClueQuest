'use client'

import { useState, useEffect, useCallback } from 'react'
import Ably from 'ably'
import styles from './Leaderboard.module.css'

type LeaderboardEntry = {
  rank: number
  code: string
  totalPoints: number
  completedCount: number
  timeTakenMs: number | null
  finishedAt: string | null
}

function formatTime(ms: number | null): string {
  if (ms === null) return '—'
  const secs = Math.floor(ms / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [resetting, setResetting] = useState(false)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/leaderboard')
      if (res.status === 401) {
        setFetchError('Session expired — please sign out and back in.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFetchError(`API error ${res.status}: ${body.error ?? 'unknown'}`)
        return
      }
      const data = await res.json()
      setFetchError(null)
      setEntries(data.leaderboard)
      setIsPublished(data.isPublished)
      setLastUpdated(new Date())
    } catch (err) {
      setFetchError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    fetchLeaderboard()

    const ably = new Ably.Realtime({
      authUrl: '/api/ably/token?clientId=admin',
      logLevel: 0,        // silence all internal Ably console output
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 10000,
    })
    const channel = ably.channels.get('leaderboard')
    channel.subscribe('leaderboard:update', () => { if (!ignore) fetchLeaderboard() })

    return () => {
      ignore = true
      channel.detach().catch(() => {})
      ably.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleReset() {
    if (!confirm('Reset the game? This clears all assignments, submissions, and points.')) return
    setResetting(true)
    await fetch('/api/admin/reset', { method: 'POST' })
    await fetchLeaderboard()
    setResetting(false)
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner} />
        <span>Loading leaderboard…</span>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className={styles.container}>
        <div className={styles.fetchError}>
          <strong>⚠ Could not load leaderboard</strong>
          <p>{fetchError}</p>
          <button onClick={fetchLeaderboard} className={styles.refreshBtn}>Try again</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Live Leaderboard</h2>
          {lastUpdated && (
            <p className={styles.updated}>
              Updated {lastUpdated.toLocaleTimeString()}
              {isPublished && <span className={styles.liveDot} />}
            </p>
          )}
        </div>
        <div className={styles.headerActions}>
          <button onClick={fetchLeaderboard} className={styles.refreshBtn}>
            ↻ Refresh
          </button>
          {isPublished && (
            <button onClick={handleReset} className={styles.resetBtn} disabled={resetting}>
              {resetting ? '…' : 'Reset Game'}
            </button>
          )}
        </div>
      </div>

      {!isPublished && (
        <div className={styles.notice}>
          Game not published yet. Go to the <strong>Challenges</strong> tab to publish.
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Rank</th>
              <th className={styles.th}>Team</th>
              <th className={styles.th}>Points</th>
              <th className={styles.th}>Solved</th>
              <th className={styles.th}>Time</th>
              <th className={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.code} className={styles.row}>
                <td className={styles.rankCell}>
                  {MEDAL[e.rank] ?? <span className={styles.rank}>#{e.rank}</span>}
                </td>
                <td className={styles.codeCell}>{e.code}</td>
                <td className={styles.pointsCell}>{e.totalPoints}</td>
                <td className={styles.td}>{e.completedCount} / 5</td>
                <td className={styles.td}>{formatTime(e.timeTakenMs)}</td>
                <td className={styles.td}>
                  {e.finishedAt ? (
                    <span className={styles.badgeFinished}>Finished</span>
                  ) : e.completedCount > 0 ? (
                    <span className={styles.badgeActive}>Playing</span>
                  ) : (
                    <span className={styles.badgeWaiting}>Waiting</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
