'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, StickyNote, BookOpen } from 'lucide-react'
import {
  fetchProgress, fetchBookmarks, EMPTY_PROGRESS,
  type Progress, type Bookmark,
} from '@/lib/quran-progress'
import { HASANAT_PER_LETTER, HASANAT_SOURCE } from '@/lib/hasanat'
import { SURAHS } from '@/lib/quran'

// ── Reward Tracker ───────────────────────────────────────────────────────
// Replaces the GreenTV tab in the dashboard. GreenTV itself is untouched —
// it still lives at /greentv and will move to the homepage feed later.
//
// A note on the framing, which matters more than the layout: letters read is
// a figure computed from the Complex's own text, so it is stated as fact.
// The multiplied figure is what the narration promises, and it is written
// that way — never "you have earned". Reward is not ours to tally, and an
// app that implies it has is overstepping.

const surahName = (n: number) => SURAHS.find(s => s.number === n)?.name || `Surah ${n}`
const surahAyahs = (n: number) => SURAHS.find(s => s.number === n)?.ayahs || 0

export default function RewardTracker() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchProgress(), fetchBookmarks()]).then(([p, b]) => {
      if (cancelled) return
      setProgress(p)
      setBookmarks(b.bookmarks)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const card: React.CSSProperties = {
    background: 'rgba(15,31,15,0.4)', border: '0.5px solid rgba(212,175,110,0.1)',
    borderRadius: '14px', padding: '20px',
  }
  const eyebrow: React.CSSProperties = {
    fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em',
    color: '#d4af6e', marginBottom: '14px',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '14px' }}/>)}
      </div>
    )
  }

  // Nowhere to store progress yet — say so plainly instead of showing zeroes
  // that look like a reading history of nothing.
  if (!progress.available) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '44px 24px' }}>
        <BookOpen className="h-7 w-7" style={{ margin: '0 auto 14px', color: 'rgba(212,175,110,0.5)' }} strokeWidth={1.4} />
        <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', lineHeight: 1.7, color: 'rgba(255,255,255,0.5)', marginBottom: '16px', maxWidth: '44ch', marginInline: 'auto' }}>
          Reading progress isn&apos;t switched on yet. Once it is, the verses you mark
          as read, the ones you star, and your notes all collect here.
        </p>
        <Link href="/quran" style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: '#0f1f0f', background: '#d4af6e', borderRadius: '9px', padding: '10px 20px', textDecoration: 'none' }}>
          OPEN THE QURAN
        </Link>
      </div>
    )
  }

  const overallPct = progress.totalVerses > 0 ? (progress.versesRead / progress.totalVerses) * 100 : 0
  const started = Object.keys(progress.perSurah).map(Number).sort((a, b) => a - b)
  const starred = bookmarks.filter(b => b.starred)
  const notes = bookmarks.filter(b => b.note)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── The headline figures ── */}
      <div style={card}>
        <div style={eyebrow}>YOUR READING</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '14px', marginBottom: '18px' }}>
          {[
            { label: 'Verses read', value: progress.versesRead.toLocaleString(), color: '#d4af6e' },
            { label: 'Letters read', value: progress.letters.toLocaleString(), color: '#5a9e5a' },
            { label: 'Surahs begun', value: String(started.length), color: 'rgba(255,255,255,0.7)' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(20px,3vw,27px)', fontWeight: 300, lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Overall bar */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10.5px', color: 'rgba(255,255,255,0.5)' }}>Whole Quran</span>
            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: '#d4af6e', fontVariantNumeric: 'tabular-nums' }}>
              {progress.versesRead.toLocaleString()} / {progress.totalVerses.toLocaleString()} · {overallPct > 0 && overallPct < 1 ? '<1' : Math.round(overallPct)}%
            </span>
          </div>
          <div style={{ height: '5px', borderRadius: '5px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, overallPct)}%`, height: '100%', borderRadius: '5px', background: '#d4af6e', transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
        </div>

        {/* The narration, stated as a promise rather than a balance */}
        <div style={{ paddingTop: '14px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', fontStyle: 'italic', lineHeight: 1.7, color: 'rgba(255,255,255,0.58)', margin: 0 }}>
            &ldquo;Whoever reads a letter from the Book of Allah receives a hasanah, and
            that hasanah is multiplied by ten.&rdquo;
            <span style={{ display: 'block', fontSize: '12px', fontStyle: 'normal', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>
              {HASANAT_SOURCE}
            </span>
          </p>
          {progress.letters > 0 && (
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14.5px', lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', margin: '12px 0 0' }}>
              On {progress.letters.toLocaleString()} letters, that is{' '}
              <span style={{ color: '#d4af6e', fontWeight: 600 }}>
                {(progress.letters * HASANAT_PER_LETTER).toLocaleString()}
              </span>{' '}
              hasanat promised, by Allah&apos;s grace. The letters are counted from the
              text; the reward is His to give, not ours to total.
            </p>
          )}
        </div>
      </div>

      {/* ── Per-surah ── */}
      {started.length > 0 && (
        <div style={card}>
          <div style={eyebrow}>SURAHS IN PROGRESS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {started.map(n => {
              const done = progress.perSurah[n] || 0
              const total = surahAyahs(n)
              const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
              const complete = total > 0 && done >= total
              return (
                <div key={n}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: complete ? '#d4af6e' : 'rgba(255,255,255,0.72)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n}. {surahName(n)}{complete ? ' ✓' : ''}
                    </span>
                    <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10.5px', color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {done}/{total}
                    </span>
                  </div>
                  <div style={{ height: '3px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: complete ? '#5a9e5a' : '#d4af6e' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Starred ── */}
      {starred.length > 0 && (
        <div style={card}>
          <div style={eyebrow}>STARRED VERSES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {starred.map(b => (
              <Link
                key={`${b.surah}:${b.ayah}`}
                href="/quran"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-inter)', fontSize: '11.5px', color: '#d4af6e', textDecoration: 'none', background: 'rgba(212,175,110,0.08)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '20px', padding: '6px 12px' }}
              >
                <Star className="h-3 w-3" fill="currentColor" />
                {b.surah}:{b.ayah}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {notes.length > 0 && (
        <div style={card}>
          <div style={eyebrow}>YOUR NOTES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notes.map(b => (
              <div key={`${b.surah}:${b.ayah}`} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '13px 15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
                  <StickyNote className="h-3.5 w-3.5" style={{ color: 'rgba(212,175,110,0.7)' }} strokeWidth={1.9} />
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.06em', color: '#d4af6e' }}>{b.surah}:{b.ayah}</span>
                </div>
                <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14.5px', lineHeight: 1.65, color: 'rgba(255,255,255,0.65)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {b.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Nothing yet ── */}
      {progress.versesRead === 0 && bookmarks.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', lineHeight: 1.7, color: 'rgba(255,255,255,0.45)', marginBottom: '16px', maxWidth: '42ch', marginInline: 'auto' }}>
            Nothing tracked yet. Open the Quran and tap the bookmark beside a verse
            to star it, keep a note, or mark it read.
          </p>
          <Link href="/quran" style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: '#0f1f0f', background: '#d4af6e', borderRadius: '9px', padding: '10px 20px', textDecoration: 'none' }}>
            START READING
          </Link>
        </div>
      )}
    </div>
  )
}
