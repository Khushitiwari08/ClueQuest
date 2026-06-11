'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/ui/AnimatedBackground'
import styles from './JoinForm.module.css'

type Mode = 'join' | 'admin-pw'

export default function JoinForm() {
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<Mode>('join')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return

    if (trimmed.toLowerCase() === 'admin') {
      setCode('')
      setError('')
      setMode('admin-pw')
      return
    }

    // Navigate directly — TeamDashboard shows "not found" if code is wrong
    setLoading(true)
    router.push(`/play/${encodeURIComponent(trimmed)}`)
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/admin')
    } else {
      setError('Incorrect password.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <AnimatedBackground />

      <main className={styles.main}>
        <div className={styles.logo}>
          <div className={styles.logoIconWrap}>
            <span className={styles.logoIcon}>🔍</span>
            <div className={styles.logoGlow} />
          </div>
          <h1 className={styles.logoText}>ClueQuest</h1>
          <p className={styles.tagline}>SEP It Up : Clues, Chaos & Competition</p>
        </div>

        <div className={styles.card}>
          {mode === 'join' ? (
            <>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Enter Your Team Code</h2>
                <p className={styles.cardDesc}>Every team has a unique code. Ask your organiser if you don&apos;t have one.</p>
              </div>

              <form onSubmit={handleJoin} className={styles.form}>
                <div className={styles.inputWrap}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Cipher"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError('') }}
                    maxLength={20}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {error && (
                  <p className={styles.error}>
                    <span>⚠</span> {error}
                  </p>
                )}

                <button type="submit" className={styles.btn} disabled={loading || !code.trim()}>
                  {loading
                    ? <span className={styles.spinner} />
                    : <><span>Join Hunt</span><span className={styles.btnArrow}>→</span></>
                  }
                </button>
              </form>
            </>
          ) : (
            <>
              <button className={styles.backBtn} onClick={() => { setMode('join'); setError(''); setPassword('') }}>
                ← Back
              </button>
              <div className={styles.cardHeader}>
                <span className={styles.adminIcon}>🔐</span>
                <h2 className={styles.cardTitle}>Admin Access</h2>
                <p className={styles.cardDesc}>Enter the admin password to continue.</p>
              </div>

              <form onSubmit={handleAdminLogin} className={styles.form}>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  autoFocus
                />
                {error && (
                  <p className={styles.error}>
                    <span>⚠</span> {error}
                  </p>
                )}
                <button type="submit" className={styles.btn} disabled={loading || !password}>
                  {loading ? <span className={styles.spinner} /> : <><span>Sign In</span><span className={styles.btnArrow}>→</span></>}
                </button>
              </form>
            </>
          )}
        </div>

        <p className={styles.hint}>Powered by SEP EC 2026</p>
      </main>
    </div>
  )
}
