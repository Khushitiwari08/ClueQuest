'use client'

import { useState } from 'react'
import OtpInput from '@/components/ui/OtpInput'
import styles from './ChallengeCard.module.css'

const THEMES = [
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  glow: 'rgba(245,158,11,0.15)' },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)',  glow: 'rgba(139,92,246,0.15)' },
  { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.3)',   glow: 'rgba(6,182,212,0.15)'  },
  { color: '#ec4899', bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)',  glow: 'rgba(236,72,153,0.15)' },
  { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  glow: 'rgba(16,185,129,0.15)' },
]

type Link = { id: string; url: string; buttonText: string; order: number }
type ChallengeData = {
  id: string; title: string; question: string
  isFinal: boolean; icon: string; answerLength: number; links: Link[]
}
type Assignment = {
  id: string; position: number; isUnlocked: boolean; isCompleted: boolean
  completedAt: string | null; pointsEarned: number | null; challenge: ChallengeData
}
type Status = 'idle' | 'wrong' | 'correct'
type SolveResult = { points: number; rank: number; nextUnlocked: boolean }
type Props = {
  assignment: Assignment; teamCode: string; isActive: boolean
  imageData: string | null
  onToggle: () => void; onSolved: (result: SolveResult) => void
}

export default function ChallengeCard({ assignment, teamCode, isActive, imageData, onToggle, onSolved }: Props) {
  const [boxes, setBoxes] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [points, setPoints] = useState<number | null>(null)
  const [rank, setRank] = useState<number | null>(null)

  const { challenge, isUnlocked, isCompleted, pointsEarned, position } = assignment
  const theme = THEMES[(position - 1) % THEMES.length]
  const icon = challenge.icon || '🔍'
  const answerLength = challenge.answerLength || 4
  const filled = boxes.filter(Boolean).length === answerLength

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!filled) return
    setSubmitting(true)
    setStatus('idle')
    const answer = boxes.join('')
    const res = await fetch(`/api/team/${teamCode}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: assignment.id, answer }),
    })
    const data = await res.json()
    if (data.correct) {
      setStatus('correct')
      setPoints(data.points)
      setRank(data.rank)
      setTimeout(() => onSolved({ points: data.points, rank: data.rank, nextUnlocked: data.nextUnlocked }), 900)
    } else {
      setStatus('wrong')
      setTimeout(() => setStatus('idle'), 1200)
    }
    setSubmitting(false)
  }

  if (!isUnlocked) {
    return (
      <div className={styles.card} style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className={styles.locked}>
          <div className={styles.lockCircle}>🔒</div>
          <div>
            <div className={styles.lockPos}>Challenge {position}</div>
            <div className={styles.lockText}>Complete the previous challenge to unlock</div>
          </div>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className={styles.completedCard} style={{ borderColor: theme.border, background: theme.bg }}>
        <div className={styles.completedRow}>
          <div className={styles.completedLeft}>
            <div className={styles.completedIconWrap} style={{ background: theme.bg, borderColor: theme.border }}>
              <span className={styles.completedIconEmoji}>{icon}</span>
              <div className={styles.doneCheck} style={{ background: theme.color }}>✓</div>
            </div>
            <div>
              <div className={styles.completedPos}>
                Challenge {position}
                {challenge.isFinal && <span className={styles.finalTag}>⭐ Final</span>}
              </div>
              <div className={styles.completedTitle}>{challenge.title}</div>
            </div>
          </div>
          <div className={styles.completedPts} style={{ color: theme.color }}>+{pointsEarned} pts</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${styles.card} ${styles.activeCard} ${isActive ? styles.expanded : ''}`}
      style={isActive ? { borderColor: theme.border, boxShadow: `0 0 0 1px ${theme.glow}, 0 8px 32px rgba(0,0,0,0.35)` } : undefined}
    >
      <button className={styles.header} onClick={onToggle}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} style={{ background: theme.bg, borderColor: theme.border, color: theme.color }}>
            <span className={styles.iconEmoji}>{icon}</span>
            {challenge.isFinal && <span className={styles.star}>⭐</span>}
          </div>
          <div>
            <div className={styles.pos} style={{ color: theme.color }}>
              Challenge {position}{challenge.isFinal ? ' · Final' : ''}
            </div>
            <div className={styles.title}>{challenge.title}</div>
          </div>
        </div>
        <div className={`${styles.chevronWrap} ${isActive ? styles.chevronUp : ''}`} style={{ borderColor: theme.border, color: theme.color }}>›</div>
      </button>

      {isActive && (
        <div className={styles.body} style={{ borderTopColor: theme.border }}>
          <div className={styles.accentBar} style={{ background: `linear-gradient(90deg, ${theme.color}, transparent)` }} />

          {imageData && (
            <div className={styles.imageWrap} style={{ borderColor: theme.border }}>
              <img src={imageData} alt="Challenge clue" className={styles.image} />
            </div>
          )}

          <p className={styles.question}>{challenge.question}</p>

          {challenge.links.length > 0 && (
            <div className={styles.links}>
              <span className={styles.linksLabel} style={{ color: theme.color }}>Clue Resources</span>
              <div className={styles.linkList}>
                {challenge.links.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                    className={styles.linkBtn}
                    style={{ background: theme.bg, borderColor: theme.border, color: theme.color }}
                  >
                    <span>{l.buttonText}</span><span className={styles.extIcon}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.answerLabel}>
              <span>Your Answer</span>
              <span className={styles.charHint} style={{ color: theme.color }}>{answerLength} characters</span>
            </div>

            <OtpInput
              length={answerLength}
              value={boxes.length === answerLength ? boxes : Array(answerLength).fill('')}
              onChange={(val) => { setBoxes(val); if (status === 'wrong') setStatus('idle') }}
              disabled={submitting || status === 'correct'}
              status={status}
              autoFocus={isActive}
            />

            {status === 'wrong' && <p className={styles.wrongMsg}>✗ Not quite — try again!</p>}
            {status === 'correct' && (
              <div className={styles.correctMsg}>
                🎉 Correct!
                {points !== null && (
                  <span className={styles.ptsBadge}>
                    +{points} pts
                    {rank === 1 ? ' 🥇 First!' : rank === 2 ? ' 🥈 Second' : rank === 3 ? ' 🥉 Third' : ''}
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!filled || submitting || status === 'correct'}
              style={filled && status !== 'correct' ? {
                background: `linear-gradient(135deg, ${theme.color}, ${theme.color}cc)`,
                boxShadow: `0 4px 16px ${theme.glow}`,
              } : undefined}
            >
              {submitting ? <span className={styles.spinner} /> : status === 'correct' ? '✓ Solved!' : 'Submit Answer'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
