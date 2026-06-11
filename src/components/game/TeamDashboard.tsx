'use client'

import { useState, useEffect, useCallback } from 'react'
import Ably from 'ably'
import ChallengeCard from './ChallengeCard'
import AnimatedBackground from '@/components/ui/AnimatedBackground'
import styles from './TeamDashboard.module.css'

type Link = { id: string; url: string; buttonText: string; order: number }
type ChallengeData = {
  id: string; title: string; question: string; imageData: string | null
  isFinal: boolean; icon: string; answerLength: number; links: Link[]
}
type Assignment = {
  id: string; position: number; isUnlocked: boolean; isCompleted: boolean
  completedAt: string | null; pointsEarned: number | null; challenge: ChallengeData
}
type TeamState = {
  team: { code: string; totalPoints: number; startedAt: string | null; finishedAt: string | null }
  gameState: { isPublished: boolean; publishedAt: string | null }
  challenges: Assignment[]
}

export default function TeamDashboard({ teamCode }: { teamCode: string }) {
  const [state, setState] = useState<TeamState | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePosition, setActivePosition] = useState<number | null>(null)

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/team/${teamCode}`)
    if (res.ok) {
      const data: TeamState = await res.json()
      setState(data)
      if (!data.gameState.isPublished) return
      const firstActive = data.challenges.find((a) => a.isUnlocked && !a.isCompleted)
      if (firstActive) setActivePosition(firstActive.position)
    }
    setLoading(false)
  }, [teamCode])

  // Optimistic update — no round trip needed after a correct answer
  const handleSolved = useCallback((assignmentId: string, points: number, nextUnlocked: boolean) => {
    setState((prev) => {
      if (!prev) return prev
      const now = new Date().toISOString()
      const challenges = prev.challenges.map((a) => {
        if (a.id === assignmentId) {
          return { ...a, isCompleted: true, completedAt: now, pointsEarned: points }
        }
        // find next by position
        const solvedPos = prev.challenges.find((x) => x.id === assignmentId)?.position ?? -1
        if (nextUnlocked && a.position === solvedPos + 1) {
          return { ...a, isUnlocked: true }
        }
        return a
      })
      const newTotal = prev.team.totalPoints + points
      const allDone = challenges.every((a) => a.isCompleted)
      return {
        ...prev,
        team: { ...prev.team, totalPoints: newTotal, finishedAt: allDone ? now : prev.team.finishedAt },
        challenges,
      }
    })
    // Move to next challenge immediately
    if (nextUnlocked) {
      setState((prev) => {
        if (!prev) return prev
        const solvedPos = prev.challenges.find((a) => a.id === assignmentId)?.position ?? -1
        const next = prev.challenges.find((a) => a.position === solvedPos + 1)
        if (next) setActivePosition(next.position)
        return prev
      })
    }
  }, [])

  useEffect(() => {
    let ignore = false

    fetchState()

    const ably = new Ably.Realtime({
      authUrl: `/api/ably/token?clientId=team-${teamCode}`,
      logLevel: 0,
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 10000,
    })
    const gameChannel = ably.channels.get('game-events')
    const teamChannel = ably.channels.get(`team-${teamCode}`)

    gameChannel.subscribe('game:published', () => { if (!ignore) fetchState() })
    gameChannel.subscribe('game:reset', () => { if (!ignore) fetchState() })
    // Ably event is backup sync only — optimistic update already handled by handleSolved
    teamChannel.subscribe('challenge:completed', () => { if (!ignore) fetchState() })

    return () => {
      ignore = true
      gameChannel.detach().catch(() => {})
      teamChannel.detach().catch(() => {})
      ably.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCode])

  if (loading) {
    return (
      <div className={styles.centered}>
        <span className={styles.spinner} />
      </div>
    )
  }

  if (!state) {
    return (
      <div className={styles.centered}>
        <p className={styles.error}>Failed to load team data.</p>
        <a href="/" className={styles.link}>← Back to home</a>
      </div>
    )
  }

  if (!state.gameState.isPublished) {
    return (
      <div className={styles.waiting}>
        <AnimatedBackground />
        <div className={styles.waitingContent}>
          <span className={styles.waitingIcon}>⏳</span>
          <h1 className={styles.waitingTitle}>Get Ready!</h1>
          <p className={styles.waitingText}>
            You&apos;re in as <strong className={styles.code}>{state.team.code}</strong>.
            <br />Waiting for the admin to start the hunt…
          </p>
          <div className={styles.pulseDot} />
        </div>
      </div>
    )
  }

  const completed = state.challenges.filter((c) => c.isCompleted).length
  const total = state.challenges.length
  const allDone = completed === total

  const THEME_COLORS = ['#f59e0b','#8b5cf6','#06b6d4','#ec4899','#10b981']
  const activeChallenge = state.challenges.find((a) => a.isUnlocked && !a.isCompleted)
  const accentColor = THEME_COLORS[((activeChallenge?.position ?? 1) - 1) % THEME_COLORS.length]

  return (
    <div className={styles.layout}>
      <AnimatedBackground />
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🔍</span>
          <div>
            <div className={styles.teamCode} style={{ color: accentColor }}>{state.team.code}</div>
            <div className={styles.headerSub}>ClueQuest</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.pointsBadge} style={{
            background: `${accentColor}18`,
            borderColor: `${accentColor}44`,
          }}>
            <span className={styles.pointsIcon}>⭐</span>
            <span className={styles.pointsValue} style={{ color: accentColor }}>{state.team.totalPoints}</span>
            <span className={styles.pointsLabel} style={{ color: accentColor }}>pts</span>
          </div>
          <a href="/" className={styles.homeLink}>Exit</a>
        </div>
      </header>

      <div className={styles.progress}>
        <div className={styles.progressInfo}>
          <span>{completed}/{total} solved</span>
          {allDone && <span className={styles.allDone}>🏆 Hunt Complete!</span>}
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(completed / total) * 100}%`, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }}
          />
        </div>
      </div>

      <main className={styles.challenges}>
        {state.challenges.map((assignment) => (
          <ChallengeCard
            key={assignment.id}
            assignment={assignment}
            teamCode={teamCode}
            isActive={activePosition === assignment.position}
            onToggle={() =>
              setActivePosition((p) =>
                p === assignment.position ? null : assignment.position
              )
            }
            onSolved={(result) => handleSolved(assignment.id, result.points, result.nextUnlocked)}
          />
        ))}
      </main>
    </div>
  )
}
