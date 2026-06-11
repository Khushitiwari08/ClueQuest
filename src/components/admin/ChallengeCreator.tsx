'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './ChallengeCreator.module.css'

const ICONS = [
  '🗺️','📜','📞','🍊','⭐','🙅','📸','🗄️','🔥','📚',
  '🎯','🧩','🔍','🗝️','🧭','🏴‍☠️','📦','🎟️','⚡','🏆',
]

type Link = { url: string; buttonText: string }
type Challenge = {
  id: string
  title: string
  question: string
  imageData: string | null
  answer: string
  icon: string
  isFinal: boolean
  links: Array<{ id: string; url: string; buttonText: string; order: number }>
}

const BLANK_FORM = {
  title: '', question: '', answer: '', icon: '🔍', isFinal: false,
  links: [{ url: '', buttonText: '' }] as Link[],
  imageFile: null as File | null,
  imagePreview: null as string | null,
  removeImage: false,
}

export default function ChallengeCreator() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState(BLANK_FORM.title)
  const [question, setQuestion] = useState(BLANK_FORM.question)
  const [answer, setAnswer] = useState(BLANK_FORM.answer)
  const [icon, setIcon] = useState(BLANK_FORM.icon)
  const [isFinal, setIsFinal] = useState(BLANK_FORM.isFinal)
  const [links, setLinks] = useState<Link[]>(BLANK_FORM.links)
  const [imageFile, setImageFile] = useState<File | null>(BLANK_FORM.imageFile)
  const [imagePreview, setImagePreview] = useState<string | null>(BLANK_FORM.imagePreview)
  const [removeImage, setRemoveImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchChallenges() {
    const res = await fetch('/api/admin/challenges')
    if (res.ok) setChallenges(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchChallenges() }, [])

  function openCreate() {
    setEditingId(null)
    setTitle(''); setQuestion(''); setAnswer(''); setIcon('🔍')
    setIsFinal(false); setLinks([{ url: '', buttonText: '' }])
    setImageFile(null); setImagePreview(null); setRemoveImage(false)
    if (fileRef.current) fileRef.current.value = ''
    setShowForm(true)
  }

  function openEdit(c: Challenge) {
    setEditingId(c.id)
    setTitle(c.title); setQuestion(c.question); setAnswer(c.answer); setIcon(c.icon || '🔍')
    setIsFinal(c.isFinal)
    setLinks(c.links.length > 0
      ? c.links.map(l => ({ url: l.url, buttonText: l.buttonText }))
      : [{ url: '', buttonText: '' }])
    setImageFile(null)
    setImagePreview(c.imageData)
    setRemoveImage(false)
    if (fileRef.current) fileRef.current.value = ''
    setShowForm(true)
    setShowIconPicker(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeForm() {
    setShowForm(false); setEditingId(null); setShowIconPicker(false)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setRemoveImage(false)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleRemoveImage() {
    setImageFile(null); setImagePreview(null); setRemoveImage(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  function addLink() { setLinks(l => [...l, { url: '', buttonText: '' }]) }
  function removeLink(i: number) { setLinks(l => l.filter((_, idx) => idx !== i)) }
  function updateLink(i: number, field: keyof Link, value: string) {
    setLinks(l => l.map((lnk, idx) => idx === i ? { ...lnk, [field]: value } : lnk))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData()
    fd.append('title', title)
    fd.append('question', question)
    fd.append('answer', answer)
    fd.append('icon', icon)
    fd.append('isFinal', String(isFinal))
    fd.append('links', JSON.stringify(links.filter(l => l.url && l.buttonText)))
    fd.append('removeImage', String(removeImage))
    if (imageFile) fd.append('image', imageFile)

    const url = editingId
      ? `/api/admin/challenges/${editingId}`
      : '/api/admin/challenges'
    const method = editingId ? 'PUT' : 'POST'

    const res = await fetch(url, { method, body: fd })
    if (res.ok) {
      closeForm()
      await fetchChallenges()
    }
    setSubmitting(false)
  }

  async function deleteChallenge(id: string) {
    if (!confirm('Delete this challenge?')) return
    await fetch(`/api/admin/challenges/${id}`, { method: 'DELETE' })
    await fetchChallenges()
  }

  async function handlePublish() {
    setPublishing(true); setPublishMsg('')
    const res = await fetch('/api/admin/publish', { method: 'POST' })
    const data = await res.json()
    setPublishMsg(res.ok
      ? `✓ Published! ${data.teamsAssigned} teams assigned.`
      : `✗ ${data.error}`)
    setPublishing(false)
  }

  const regular = challenges.filter(c => !c.isFinal)
  const finals  = challenges.filter(c => c.isFinal)
  const canPublish = regular.length >= 4 && finals.length >= 1

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Challenges</h2>
          <p className={styles.subtitle}>
            {regular.length} regular · {finals.length} final
            {!canPublish && (
              <span className={styles.need}>
                {' '}(need {Math.max(0, 4 - regular.length)} more regular
                {finals.length === 0 ? ' + 1 final' : ''})
              </span>
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={openCreate} className={styles.addBtn}>+ New Challenge</button>
          <button onClick={handlePublish} className={styles.publishBtn} disabled={!canPublish || publishing}>
            {publishing ? '…' : '🚀 Publish Game'}
          </button>
        </div>
      </div>

      {publishMsg && (
        <div className={`${styles.publishMsg} ${publishMsg.startsWith('✓') ? styles.publishSuccess : styles.publishError}`}>
          {publishMsg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formTitleRow}>
            <h3 className={styles.formTitle}>{editingId ? '✏️ Edit Challenge' : '+ New Challenge'}</h3>
            <button type="button" onClick={closeForm} className={styles.formCloseBtn}>✕</button>
          </div>

          {/* Icon picker */}
          <div className={styles.field}>
            <label className={styles.label}>Icon</label>
            <div className={styles.iconRow}>
              <button
                type="button"
                className={styles.selectedIcon}
                onClick={() => setShowIconPicker(v => !v)}
                title="Choose icon"
              >
                <span className={styles.selectedIconEmoji}>{icon}</span>
                <span className={styles.selectedIconHint}>{showIconPicker ? 'Close' : 'Change'}</span>
              </button>
              {showIconPicker && (
                <div className={styles.iconGrid}>
                  {ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      className={`${styles.iconOption} ${icon === ic ? styles.iconOptionActive : ''}`}
                      onClick={() => { setIcon(ic); setShowIconPicker(false) }}
                      title={ic}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Title *</label>
              <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} required placeholder="Challenge name" />
            </div>
            <div className={styles.fieldSmall}>
              <label className={styles.label}>Type</label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={isFinal} onChange={e => setIsFinal(e.target.checked)} />
                <span>Final challenge</span>
              </label>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Question *</label>
            <textarea className={styles.textarea} value={question} onChange={e => setQuestion(e.target.value)} required rows={3} placeholder="What must teams solve?" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Correct Answer *</label>
            <input className={styles.input} value={answer} onChange={e => setAnswer(e.target.value)} required placeholder="Case-insensitive, spaces ignored" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Image (optional)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className={styles.fileInput} />
            {imagePreview && (
              <div className={styles.imagePreview}>
                <img src={imagePreview} alt="Preview" />
                <button type="button" className={styles.removeImage} onClick={handleRemoveImage}>Remove</button>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <div className={styles.linksHeader}>
              <label className={styles.label}>Clue Links</label>
              <button type="button" onClick={addLink} className={styles.addLinkBtn}>+ Add Link</button>
            </div>
            {links.map((lnk, i) => (
              <div key={i} className={styles.linkRow}>
                <input className={styles.input} value={lnk.buttonText} onChange={e => updateLink(i, 'buttonText', e.target.value)} placeholder="Button text" />
                <input className={`${styles.input} ${styles.inputFlex}`} value={lnk.url} onChange={e => updateLink(i, 'url', e.target.value)} placeholder="https://…" type="url" />
                {links.length > 1 && (
                  <button type="button" className={styles.removeLinkBtn} onClick={() => removeLink(i)}>✕</button>
                )}
              </div>
            ))}
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={closeForm} className={styles.cancelBtn}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Challenge'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : challenges.length === 0 ? (
        <div className={styles.empty}>No challenges yet. Create your first one above.</div>
      ) : (
        <div className={styles.list}>
          {[...finals, ...regular].map(c => (
            <div key={c.id} className={`${styles.challengeCard} ${c.isFinal ? styles.finalCard : ''}`}>
              <div className={styles.challengeHeader}>
                <div className={styles.challengeMeta}>
                  <span className={styles.challengeIconBadge}>{c.icon || '🔍'}</span>
                  {c.isFinal && <span className={styles.finalBadge}>⭐ Final</span>}
                  <h3 className={styles.challengeTitle}>{c.title}</h3>
                </div>
                <div className={styles.challengeActions}>
                  <button onClick={() => openEdit(c)} className={styles.editBtn}>Edit</button>
                  <button onClick={() => deleteChallenge(c.id)} className={styles.deleteBtn}>Delete</button>
                </div>
              </div>
              <p className={styles.challengeQuestion}>{c.question}</p>
              <div className={styles.challengeFooter}>
                <span className={styles.muted}>Answer: <code>{c.answer}</code></span>
                {c.links.length > 0 && <span className={styles.muted}>{c.links.length} link{c.links.length !== 1 ? 's' : ''}</span>}
                {c.imageData && <span className={styles.muted}>📷 Image</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
