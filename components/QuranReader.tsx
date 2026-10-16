'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  SURAHS, fetchChapters, fetchSurah, fetchTafsir,
  DEFAULT_TRANSLATION_ID,
  type Chapter, type SurahPayload,
} from '@/lib/quran'
import AyahMark from '@/components/AyahMark'
import VerseActions from '@/components/VerseActions'
import {
  fetchProgress, markVerse, fetchBookmarks, saveBookmark,
  EMPTY_PROGRESS, type Progress, type Bookmark,
} from '@/lib/quran-progress'
import { HASANAT_PER_LETTER, HASANAT_SOURCE } from '@/lib/hasanat'

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)',
  borderRadius: '9px', padding: '9px 12px', fontFamily: 'var(--font-inter)',
  fontSize: '13px', color: '#fff', outline: 'none',
}

// Uthmani script only — no script picker, by design.
const UTHMANI: React.CSSProperties = {
  fontFamily: 'var(--font-uthmani)',
  direction: 'rtl',
  textAlign: 'right',
  lineHeight: 2.25,
  letterSpacing: 0,
}

const PREF_KEY = 'ge_quran_prefs'

export default function QuranReader() {
  const [search, setSearch] = useState('')
  const [surahNumber, setSurahNumber] = useState(1)
  const [chapters, setChapters] = useState<Chapter[] | null>(null)

  // Saheeh International only — there is no picker. The id is resolved by
  // name on the server (lib/quran-api.ts); this constant is just the default
  // the first request carries.
  const translationId = DEFAULT_TRANSLATION_ID

  const [data, setData] = useState<SurahPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // Progress, stars and notes. All of it optional: if the migration has not
  // been run or nobody is signed in, `available` stays false and none of the
  // bars or strips render. The Quran itself never depends on this.
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS)
  const [marks, setMarks] = useState<Record<string, Bookmark>>({})
  const [busyVerse, setBusyVerse] = useState<string | null>(null)
  const [dismissedResume, setDismissedResume] = useState(false)

  const [tafsirFor, setTafsirFor] = useState<number | null>(null)
  const [tafsir, setTafsir] = useState<{ text: string; name: string } | null>(null)
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [tafsirMissing, setTafsirMissing] = useState(false)

  // Restore the surah they were last on
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.surah >= 1 && p.surah <= 114) setSurahNumber(p.surah)
      }
    } catch {}
    fetchChapters().then(setChapters)
  }, [])

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ surah: surahNumber })) } catch {}
  }, [surahNumber])

  // One request per surah gives both the bars and the per-verse ticks.
  useEffect(() => {
    let cancelled = false
    fetchProgress(surahNumber).then(p => { if (!cancelled) setProgress(p) })
    fetchBookmarks().then(({ bookmarks }) => {
      if (cancelled) return
      const map: Record<string, Bookmark> = {}
      for (const b of bookmarks) map[`${b.surah}:${b.ayah}`] = b
      setMarks(map)
    })
    return () => { cancelled = true }
  }, [surahNumber])

  const readSet = new Set(progress.readInSurah)

  const toggleRead = async (ayah: number, next: boolean) => {
    const key = `${surahNumber}:${ayah}`
    setBusyVerse(key)
    const ok = await markVerse(surahNumber, ayah, next)
    if (ok) setProgress(await fetchProgress(surahNumber))
    setBusyVerse(null)
  }

  const patchMark = async (ayah: number, patch: { starred?: boolean; note?: string | null }) => {
    const key = `${surahNumber}:${ayah}`
    setBusyVerse(key)
    const saved = await saveBookmark(surahNumber, ayah, patch)
    if (saved) {
      setMarks(prev => {
        const next = { ...prev }
        if (!saved.starred && !saved.note) delete next[key]
        else next[key] = saved
        return next
      })
    }
    setBusyVerse(null)
  }

  // Load the surah
  useEffect(() => {
    let cancelled = false
    setLoading(true); setFailed(false); setTafsirFor(null)
    fetchSurah(surahNumber, translationId).then(payload => {
      if (cancelled) return
      if (!payload) { setFailed(true); setData(null) } else { setData(payload) }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [surahNumber, translationId])

  const retry = useCallback(() => {
    setLoading(true); setFailed(false)
    fetchSurah(surahNumber, translationId).then(p => {
      if (p) { setData(p); setFailed(false) } else { setFailed(true) }
      setLoading(false)
    })
  }, [surahNumber, translationId])

  const openTafsir = useCallback(async (ayah: number) => {
    if (tafsirFor === ayah) { setTafsirFor(null); return }
    setTafsirFor(ayah); setTafsir(null); setTafsirMissing(false); setTafsirLoading(true)
    const t = await fetchTafsir(surahNumber, ayah)
    setTafsirLoading(false)
    if (t) setTafsir(t); else setTafsirMissing(true)
  }, [tafsirFor, surahNumber])

  // Sidebar list — API chapters when available, local list until then
  const list = chapters
    ? chapters.map(c => ({ number: c.id, name: c.name_simple, arabicName: c.name_arabic, ayahs: c.verses_count, type: c.revelation_place === 'makkah' ? 'Meccan' : 'Medinan' }))
    : SURAHS.map(s => ({ ...s }))

  const filtered = list.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || String(s.number).includes(search)
  )
  const current = list.find(s => s.number === surahNumber)

  return (
    <div className="quran-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '22px', alignItems: 'start' }}>

      {/* ── Surah list ── */}
      <aside className="quran-sidebar" style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '14px', maxHeight: '72vh', overflowY: 'auto', position: 'sticky', top: '92px' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search surah…" style={{ ...inputStyle, width: '100%', marginBottom: '10px' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filtered.map(s => {
            const active = s.number === surahNumber
            return (
              <button
                key={s.number}
                onClick={() => { setSurahNumber(s.number); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                  background: active ? 'rgba(212,175,110,0.12)' : 'transparent',
                  border: 'none', borderRadius: '8px', padding: '9px 10px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: active ? 'var(--gold)' : 'rgba(255,255,255,0.3)', minWidth: '18px' }}>{s.number}</span>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12.5px', color: active ? 'var(--gold)' : 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                </span>
                <span style={{ fontFamily: 'var(--font-uthmani)', fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>{s.arabicName}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Reader ── */}
      <div>
        {/* One translation, stated rather than chosen. Uthmani script only. */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', marginBottom: '20px' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)' }}>TRANSLATION</span>
          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12.5px', color: 'rgba(255,255,255,0.65)' }}>
            Saheeh International
          </span>
        </div>

        {/* Surah header */}
        {current && (
          <div style={{ textAlign: 'center', marginBottom: '26px', paddingBottom: '22px', borderBottom: '0.5px solid rgba(212,175,110,0.14)' }}>
            <div style={{ fontFamily: 'var(--font-uthmani)', fontSize: '38px', color: 'var(--gold)', lineHeight: 1.6, marginBottom: '8px' }} dir="rtl">{current.arabicName}</div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>{current.number}. {current.name}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
              {current.type.toUpperCase()} · {current.ayahs} VERSES
            </div>
          </div>
        )}

        {/* ── Progress ──────────────────────────────────────────────────
            Two bars: this surah, and the whole mushaf. Only shown when
            there is somewhere to store progress — see lib/quran-progress.ts.
            Verses count when the reader marks them and never from scrolling,
            so these bars mean something. */}
        {progress.available && current && (
          <div style={{ display: 'grid', gap: '12px', marginBottom: '24px', padding: '16px 18px', background: 'rgba(15,31,15,0.45)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '13px' }}>
            {[
              { label: current.name, done: progress.perSurah[surahNumber] || 0, total: current.ayahs },
              { label: 'Whole Quran', done: progress.versesRead, total: progress.totalVerses },
            ].map(({ label, done, total }) => {
              const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10.5px', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--gold)' }}>
                      {done.toLocaleString()} / {total.toLocaleString()} &middot; {pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%
                    </span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: 'var(--gold)', transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
                  </div>
                </div>
              )
            })}

            {progress.letters > 0 && (
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', fontStyle: 'italic', lineHeight: 1.6, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>
                {progress.letters.toLocaleString()} letters read &mdash; the narration in {HASANAT_SOURCE} promises a hasanah
                for each, multiplied by {HASANAT_PER_LETTER}: <span style={{ color: 'var(--gold)', fontStyle: 'normal' }}>{(progress.letters * HASANAT_PER_LETTER).toLocaleString()}</span>.
              </p>
            )}
          </div>
        )}

        {/* Resume — only when they were last reading somewhere else */}
        {progress.available && progress.resume && !dismissedResume && progress.resume.surah !== surahNumber && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '22px', padding: '12px 16px', background: 'rgba(212,175,110,0.07)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '11px' }}>
            <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', flex: 1, minWidth: '160px' }}>
              You left off at {progress.resume.surah}:{progress.resume.ayah}.
            </span>
            <button
              onClick={() => { setSurahNumber(progress.resume!.surah); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', padding: '8px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#0f1f0f' }}
            >
              PICK UP THERE
            </button>
            <button
              onClick={() => setDismissedResume(true)}
              style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, padding: '8px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.35)' }}
            >
              Not now
            </button>
          </div>
        )}

        {/* Bismillah — rendered as its own header, never merged into verse 1 */}
        {!loading && data?.showBismillah && data.bismillah && (
          <div style={{ ...UTHMANI, textAlign: 'center', fontSize: '27px', color: 'rgba(245,240,230,0.92)', margin: '0 0 30px', lineHeight: 2 }} dir="rtl">
            {data.bismillah}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '110px', borderRadius: '12px' }}/>)}
          </div>
        ) : failed || !data ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(226,75,74,0.06)', border: '0.5px solid rgba(226,75,74,0.2)', borderRadius: '14px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '16px' }}>
              We couldn&apos;t load this surah right now. Rather than show text we can&apos;t verify, we&apos;ve stopped here.
            </p>
            <button onClick={retry} style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.verses.map(v => {
              const mk = marks[`${surahNumber}:${v.number}`]
              const vState = { starred: !!mk?.starred, note: mk?.note ?? null, read: readSet.has(v.number) }
              return (
              <div key={v.key} style={{ position: 'relative', background: vState.read ? 'rgba(212,175,110,0.05)' : 'rgba(15,31,15,0.4)', border: `0.5px solid ${vState.read ? 'rgba(212,175,110,0.22)' : 'rgba(212,175,110,0.1)'}`, borderRadius: '12px', padding: '20px 22px', transition: 'background 0.25s, border-color 0.25s' }}>

                {/* verse key + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.08em', color: 'rgba(212,175,110,0.75)', background: 'rgba(212,175,110,0.08)', borderRadius: '20px', padding: '3px 10px', flexShrink: 0 }}>{v.key}</span>
                    {progress.available && (
                      <VerseActions
                        surah={surahNumber}
                        ayah={v.number}
                        state={vState}
                        busy={busyVerse === `${surahNumber}:${v.number}`}
                        onStar={next => patchMark(v.number, { starred: next })}
                        onNote={next => patchMark(v.number, { note: next })}
                        onRead={next => toggleRead(v.number, next)}
                      />
                    )}
                  </span>
                  <button
                    onClick={() => openTafsir(v.number)}
                    style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.06em', color: tafsirFor === v.number ? 'var(--gold)' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {tafsirFor === v.number ? 'Hide tafsir ▲' : 'Tafsir ▼'}
                  </button>
                </div>

                {/* ── The verse, then its ornament ───────────────────────────
                    The Arabic is the Complex's text with nothing added. The
                    numeral is the Complex's own ayah number, separated off in
                    lib/quran-api.ts (where that split is asserted) so it can
                    be drawn inside the traditional rosette instead of sitting
                    at the end of the line as a bare digit.
                    AyahMark draws the frame; it never composes the number. */}
                <p style={{ ...UTHMANI, fontSize: '30px', color: '#f5f0e6', margin: '0 0 16px' }} dir="rtl" lang="ar">
                  {v.uthmani}
                  <AyahMark numeral={v.numeral} />
                </p>

                {/* Translation */}
                {v.translation && (
                  <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', color: 'rgba(255,255,255,0.62)', lineHeight: 1.75, margin: 0 }}>
                    {v.translation}
                  </p>
                )}

                {/* Tafsir — Ibn Kathir (English) only */}
                {tafsirFor === v.number && (
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.12em', color: 'rgba(212,175,110,0.7)', marginBottom: '10px', textTransform: 'uppercase' }}>
                      Tafsir Ibn Kathir
                    </div>
                    {tafsirLoading ? (
                      <div className="skeleton" style={{ height: '60px', borderRadius: '8px' }}/>
                    ) : tafsirMissing || !tafsir ? (
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '12.5px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                        No Ibn Kathir commentary is available for this verse.
                      </div>
                    ) : (
                      <div
                        className="tafsir-body"
                        style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.8 }}
                        dangerouslySetInnerHTML={{ __html: tafsir.text }}
                      />
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}

        <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', textAlign: 'center', marginTop: '24px', lineHeight: 1.7 }}>
          Arabic text (Uthmani script), the Saheeh International translation and Tafsir Ibn Kathir are served by the Quran.com API.
          <br/>Offered for reading and reflection, not as a substitute for scholarly guidance.
        </p>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .quran-grid { grid-template-columns: 1fr !important; }
          .quran-sidebar { position: static !important; max-height: 260px !important; }
        }
        .tafsir-body p { margin: 0 0 10px; }
        .tafsir-body h1, .tafsir-body h2, .tafsir-body h3, .tafsir-body h4 {
          font-family: var(--font-cinzel); font-size: 13px; color: rgba(212,175,110,0.85);
          margin: 14px 0 8px; font-weight: 500; letter-spacing: 0.04em;
        }
        .tafsir-body ul, .tafsir-body ol { margin: 0 0 10px; padding-inline-start: 20px; }
        .tafsir-body blockquote {
          margin: 10px 0; padding-inline-start: 14px;
          border-inline-start: 2px solid rgba(212,175,110,0.3); color: rgba(255,255,255,0.7);
        }
      `}</style>
    </div>
  )
}
