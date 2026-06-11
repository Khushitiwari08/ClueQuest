'use client'

import { useRef, useEffect, ClipboardEvent, KeyboardEvent } from 'react'
import styles from './OtpInput.module.css'

type Status = 'idle' | 'wrong' | 'correct'

interface Props {
  length: number
  value: string[]
  onChange: (val: string[]) => void
  disabled?: boolean
  status?: Status
  autoFocus?: boolean
}

export default function OtpInput({ length, value, onChange, disabled, status = 'idle', autoFocus }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  // When status changes to wrong, shake then refocus first empty box
  useEffect(() => {
    if (status === 'wrong') {
      const firstEmpty = value.findIndex((v) => !v)
      setTimeout(() => refs.current[firstEmpty === -1 ? 0 : firstEmpty]?.focus(), 100)
    }
  }, [status, value])

  function handleChange(i: number, raw: string) {
    const char = raw.slice(-1) // last typed char
    if (!char) return
    const next = [...value]
    next[i] = char
    onChange(next)
    if (i < length - 1) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...value]
      if (next[i]) {
        next[i] = ''
        onChange(next)
      } else if (i > 0) {
        next[i - 1] = ''
        onChange(next)
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\s/g, '').slice(0, length)
    const next = Array.from({ length }, (_, i) => text[i] ?? '')
    onChange(next)
    const focusIdx = Math.min(text.length, length - 1)
    refs.current[focusIdx]?.focus()
  }

  function handleFocus(i: number) {
    // Move cursor to end by re-selecting
    refs.current[i]?.select()
  }

  const boxClass = (i: number) => {
    const base = styles.box
    if (status === 'correct') return `${base} ${styles.correct}`
    if (status === 'wrong') return `${base} ${styles.wrong}`
    if (value[i]) return `${base} ${styles.filled}`
    return base
  }

  return (
    <div className={`${styles.root} ${status === 'wrong' ? styles.shake : ''}`}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className={boxClass(i)}
          type="text"
          inputMode="text"
          maxLength={2}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(i)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      ))}
    </div>
  )
}
