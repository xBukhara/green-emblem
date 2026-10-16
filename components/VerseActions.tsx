'use client'
import { useEffect, useRef, useState } from 'react'
import { Bookmark, Star, StickyNote, Check, X } from 'lucide-react'

// ── The verse action strip ───────────────────────────────────────────────
// A bookmark tab sits at the edge of each verse. Tapping it slides a strip
// out from behind it — star, note, mark read — then slides back. Subtle on
// purpose: a reader is reading, and a control that announces itself on every
// verse would be noise 6,236 times over.
//
// The strip is a transform/opacity transition, so it costs no layout, and it
// respects prefers-reduced-motion through globals.
//
// Nothing here writes to the Arabic. These controls sit outside the verse
// text entirely.

export type VerseState = { starred: boolean; note: string | null; read: boolean }

export default function VerseActions({
  surah, ayah, state, busy, onStar, onNote, onRead,
}: {
  surah: number
  ayah: number
  state: VerseState
  busy?: boolean
  onStar: (next: boolean) => void
  onNote: (next: string | null) => void
  onRead: (next: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(state.note || '')
  const wrap = useRef<HTMLDivElement>(null)

  // Close when attention moves elsewhere, so strips never stack open down
  // the whole surah.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent | TouchEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setEditing(false) }
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setEditing(false) } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  useEffect(() => { setDraft(state.note || '') }, [state.note])

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
    border: 'none', background: 'transparent', cursor: busy ? 'wait' : 'pointer',
    padding: '7px 10px', borderRadius: '7px', color: 'rgba(255,255,255,0.55)',
    whiteSpace: 'nowrap',
  }
  const on: React.CSSProperties = { color: 'var(--gold)', background: 'rgba(212,175,110,0.12)' }

  const marked = state.starred || !!state.note || state.read

  return (
    <div ref={wrap} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
      {/* The tab you tap */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? `Hide options for verse ${ayah}` : `Options for verse ${ayah}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', flexShrink: 0,
          border: 'none', borderRadius: '8px', cursor: 'pointer',
          background: open ? 'rgba(212,175,110,0.14)' : 'transparent',
          color: marked ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
          transition: 'background 0.18s, color 0.18s',
        }}
      >
        <Bookmark className="h-[15px] w-[15px]" fill={marked ? 'currentColor' : 'none'} strokeWidth={1.8} />
      </button>

      {/* The strip */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '2px', overflow: 'hidden',
          maxWidth: open ? '340px' : '0px',
          opacity: open ? 1 : 0,
          transform: open ? 'translateX(0)' : 'translateX(-8px)',
          transition: 'max-width 0.26s cubic-bezier(0.22,1,0.36,1), opacity 0.2s, transform 0.26s cubic-bezier(0.22,1,0.36,1)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        <button
          onClick={() => onStar(!state.starred)}
          disabled={busy}
          aria-pressed={state.starred}
          style={{ ...btn, ...(state.starred ? on : {}) }}
        >
          <Star className="h-[13px] w-[13px]" fill={state.starred ? 'currentColor' : 'none'} strokeWidth={1.9} />
          {state.starred ? 'Starred' : 'Star'}
        </button>

        <button
          onClick={() => setEditing(v => !v)}
          disabled={busy}
          aria-pressed={!!state.note}
          style={{ ...btn, ...(state.note ? on : {}) }}
        >
          <StickyNote className="h-[13px] w-[13px]" strokeWidth={1.9} />
          {state.note ? 'Note' : 'Add note'}
        </button>

        <button
          onClick={() => onRead(!state.read)}
          disabled={busy}
          aria-pressed={state.read}
          style={{ ...btn, ...(state.read ? on : {}) }}
        >
          <Check className="h-[13px] w-[13px]" strokeWidth={2.2} />
          {state.read ? 'Read' : 'Mark read'}
        </button>
      </div>

      {/* Note editor — opens below the strip rather than over the verse */}
      {editing && open && (
        <div
          style={{
            position: 'absolute', left: '14px', right: '14px', zIndex: 5,
            marginTop: '46px',
            background: 'rgba(10,26,10,0.98)', border: '0.5px solid rgba(212,175,110,0.25)',
            borderRadius: '11px', padding: '12px', boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
          }}
        >
          <label
            htmlFor={`note-${surah}-${ayah}`}
            style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: '7px' }}
          >
            NOTE ON {surah}:{ayah}
          </label>
          <textarea
            id={`note-${surah}-${ayah}`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="For yourself — nobody else sees this."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(212,175,110,0.2)', borderRadius: '8px',
              padding: '9px 11px', fontFamily: 'var(--font-cormorant)', fontSize: '14px',
              color: '#fff', outline: 'none', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '9px' }}>
            <button
              onClick={() => { onNote(draft.trim() || null); setEditing(false) }}
              disabled={busy}
              style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '8px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#0f1f0f' }}
            >
              SAVE
            </button>
            {state.note && (
              <button
                onClick={() => { setDraft(''); onNote(null); setEditing(false) }}
                disabled={busy}
                style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '8px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: 'rgba(226,75,74,0.14)', color: '#e24b4a' }}
              >
                DELETE
              </button>
            )}
            <button
              onClick={() => { setDraft(state.note || ''); setEditing(false) }}
              style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', padding: '8px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.45)', marginLeft: 'auto' }}
            >
              <X className="h-[13px] w-[13px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
