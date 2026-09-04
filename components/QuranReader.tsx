'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  SURAHS, fetchChapters, fetchTranslations, fetchSurah, fetchTafsir,
  toArabicNumber, DEFAULT_TRANSLATION_ID,
  type Chapter, type SurahPayload, type TranslationOption,
} from '@/lib/quran'

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

  const [translations, setTranslations] = useState<TranslationOption[]>([])
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION_ID)

  const [data, setData] = useState<SurahPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [tafsirFor, setTafsirFor] = useState<number | null>(null)
  const [tafsir, setTafsir] = useState<{ text: string; name: string } | null>(null)
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [tafsirMissing, setTafsirMissing] = useState(false)

  // Restore last-read position + translation choice
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.surah >= 1 && p.surah <= 114) setSurahNumber(p.surah)
        if (p.translationId) setTranslationId(p.translationId)
      }
    } catch {}
    fetchChapters().then(setChapters)
    fetchTranslations().then(list => {
      setTranslations(list)
      // If the saved/default translation isn't offered, fall back to the first
      setTranslationId(prev => (list.length && !list.some(t => t.id === prev)) ? list[0].id : prev)
    })
  }, [])

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ surah: surahNumber, translationId })) } catch {}
  }, [surahNumber, translationId])

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
        {/* Translation picker (script is always Uthmani) */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)' }}>TRANSLATION</span>
          <select
            value={translationId}
            onChange={e => setTranslationId(Number(e.target.value))}
            style={{ ...inputStyle, cursor: 'pointer', flex: 1, minWidth: '220px' }}
          >
            {translations.length === 0 && <option value={DEFAULT_TRANSLATION_ID}>The Clear Quran — Dr. Mustafa Khattab</option>}
            {translations.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
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
            {data.verses.map(v => (
              <div key={v.key} style={{ background: 'rgba(15,31,15,0.4)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '12px', padding: '20px 22px' }}>

                {/* verse key + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.08em', color: 'rgba(212,175,110,0.75)', background: 'rgba(212,175,110,0.08)', borderRadius: '20px', padding: '3px 10px' }}>{v.key}</span>
                  <button
                    onClick={() => openTafsir(v.number)}
                    style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.06em', color: tafsirFor === v.number ? 'var(--gold)' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {tafsirFor === v.number ? 'Hide tafsir ▲' : 'Tafsir ▼'}
                  </button>
                </div>

                {/* Uthmani text with end-of-ayah marker */}
                <p style={{ ...UTHMANI, fontSize: '30px', color: '#f5f0e6', margin: '0 0 16px' }} dir="rtl" lang="ar">
                  {v.uthmani}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '34px', height: '34px', margin: '0 8px', verticalAlign: 'middle',
                    borderRadius: '50%', border: '1px solid rgba(212,175,110,0.5)',
                    fontFamily: 'var(--font-uthmani)', fontSize: '13px', color: 'var(--gold)', lineHeight: 1,
                  }} aria-label={`Ayah ${v.number}`}>
                    {toArabicNumber(v.number)}
                  </span>
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
            ))}
          </div>
        )}

        <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', textAlign: 'center', marginTop: '24px', lineHeight: 1.7 }}>
          Arabic text (Uthmani script), translations and Tafsir Ibn Kathir are served by the Quran.com API.
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
