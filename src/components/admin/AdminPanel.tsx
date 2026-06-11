'use client'

import { useState, useEffect } from 'react'
import Leaderboard from './Leaderboard'
import ChallengeCreator from './ChallengeCreator'
import styles from './AdminPanel.module.css'

type Tab = 'leaderboard' | 'challenges'

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('leaderboard')

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.ok ? setAuthed(true) : setAuthed(false))
      .finally(() => setChecking(false))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAuthed(true)
    } else {
      setLoginError('Incorrect password')
    }
    setLoginLoading(false)
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setAuthed(false)
    setPassword('')
  }

  if (checking) {
    return (
      <div className={styles.centered}>
        <span className={styles.spinner} />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className={styles.centered}>
        <div className={styles.loginCard}>
          <span className={styles.loginIcon}>🔐</span>
          <h1 className={styles.loginTitle}>Admin Access</h1>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <input
              type="password"
              className={styles.loginInput}
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {loginError && <p className={styles.loginError}>{loginError}</p>}
            <button type="submit" className={styles.loginBtn} disabled={loginLoading}>
              {loginLoading ? <span className={styles.spinner} /> : 'Sign In'}
            </button>
          </form>
          <a href="/" className={styles.backLink}>← Back to game</a>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🔍</span>
          <h1 className={styles.headerTitle}>ClueQuest Admin</h1>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>Sign Out</button>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'leaderboard' ? styles.tabActive : ''}`}
          onClick={() => setTab('leaderboard')}
        >
          📊 Leaderboard
        </button>
        <button
          className={`${styles.tab} ${tab === 'challenges' ? styles.tabActive : ''}`}
          onClick={() => setTab('challenges')}
        >
          🧩 Challenges
        </button>
      </div>

      <main className={styles.content}>
        <div style={{ display: tab === 'leaderboard' ? 'block' : 'none' }}><Leaderboard /></div>
        <div style={{ display: tab === 'challenges' ? 'block' : 'none' }}><ChallengeCreator /></div>
      </main>
    </div>
  )
}
