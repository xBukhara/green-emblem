'use client'
import { useEffect, useState } from 'react'
import { SURAHS, getEditions, getSurah, getTafsir, DEFAULT_SCRIPT, DEFAULT_TRANSLATION, type Edition, type SurahData, type TafsirEntry } from '@/lib/quran'

const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', padding: '9px 12px', fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#fff', outline: 'none' }

export default function QuranReader() {
  const [search, setSearch] = useState('')
  const [surahNumber, setSurahNumber] = useState(1)

  const [scripts, setScripts] = useState<Edition[]>([])
  const [translations, setTranslations] = useState<Edition[]>([])
  const [scriptId, setScriptId] = useState(DEFAULT_SCRIPT)
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION)

  const [arabic, setArabic] = useState<SurahData | null>(null)
  const [translation, setTranslation] = useState<SurahData | null>(null)
  const [loading, setLoading] = useState(true)

  const [tafsirOpenFor, setTafsirOpenFor] = useState<number | null>(null)
  const [tafsirData, setTafsirData] = useState<TafsirEntry[]>([])
  const [tafsirLoading, setTafsirLoading] = useState(false)

  // Load edition lists once (live, with graceful fallback baked into lib/quran.ts)
  useEffect(() => {
    getEditions('quran', 'ar').then(eds => {
      // Prefer editions whose identifier suggests Uthmani or Indo-Pak script
      setScripts(eds)
    })
    getEditions('translation', 'en').then(setTranslations)
  }, [])

  // Load surah text whenever surah or edition selection changes
  useEffect(() => {
    setLoading(true)
    setTafsirOpenFor(null)
    Promise.all([
      getSurah(surahNumber, scriptId),
      getSurah(surahNumber, translationId),
    ]).then(([a, t]) => {
      setArabic(a)
      setTranslation(t)
      setLoading(false)
    })
  }, [surahNumber, scriptId, translationId])

  const openTafsir = async (ayahNumber: number) => {
    if (tafsirOpenFor === ayahNumber) { setTafsirOpenFor(null); return }
    setTafsirOpenFor(ayahNumber)
    setTafsirLoading(true)
    const data = await getTafsir(surahNumber, ayahNumber)
    setTafsirData(data)
    setTafsirLoading(false)
  }

  const filteredSurahs = SURAHS.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || String(s.number).includes(search)
  )
  const currentSurah = SURAHS.find(s => s.number === surahNumber)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }} className="quran-reader-grid">
      {/* ── Surah list ── */}
      <div style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '14px', maxHeight: '560px', overflowY: 'auto' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search surah…" style={{ ...inputStyle, width: '100%', marginBottom: '10px' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filteredSurahs.map(s => (
            <button
              key={s.number}
              onClick={() => setSurahNumber(s.number)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: s.number === surahNumber ? 'rgba(212,175,110,0.12)' : 'transparent',
                border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12.5px', color: s.number === surahNumber ? 'var(--gold)' : 'rgba(255,255,255,0.7)' }}>
                {s.number}. {s.name}
              </span>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{s.arabicName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Reader ── */}
      <div>
        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <select value={scriptId} onChange={e => setScriptId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', flex: 1, minWidth: '160px' }}>
            {scripts.map(e => <option key={e.identifier} value={e.identifier}>{e.englishName || e.name}</option>)}
          </select>
          <select value={translationId} onChange={e => setTranslationId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', flex: 1, minWidth: '160px' }}>
            {translations.map(e => <option key={e.identifier} value={e.identifier}>{e.englishName || e.name}</option>)}
          </select>
        </div>

        {/* Header */}
        {currentSurah && (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '32px', color: 'var(--gold)', marginBottom: '6px' }}>{currentSurah.arabicName}</div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '15px', color: '#fff' }}>{currentSurah.number}. {currentSurah.name}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{currentSurah.type} · {currentSurah.ayahs} verses</div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '70px', borderRadius: '12px' }}/>)}
          </div>
        ) : !arabic ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            Couldn't load this surah right now — please try again.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {arabic.ayahs.map((ayah, i) => {
              const t = translation?.ayahs[i]
              return (
                <div key={ayah.number} style={{ background: 'rgba(15,31,15,0.4)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '12px', padding: '18px 20px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', color: 'var(--gold)', opacity: 0.6, marginTop: '4px' }}>{ayah.numberInSurah}</span>
                    <p dir="rtl" style={{ flex: 1, fontFamily: 'var(--font-arabic)', fontSize: '24px', color: '#fff', lineHeight: 2, textAlign: 'right', margin: 0 }}>{ayah.text}</p>
                  </div>
                  {t && <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '10px' }}>{t.text}</p>}
                  <button onClick={() => openTafsir(ayah.numberInSurah)} style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.06em', color: 'rgba(212,175,110,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {tafsirOpenFor === ayah.numberInSurah ? 'Hide tafsir ▲' : 'Show tafsir ▼'}
                  </button>
                  {tafsirOpenFor === ayah.numberInSurah && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                      {tafsirLoading ? (
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Loading tafsir…</div>
                      ) : tafsirData.length === 0 ? (
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No tafsir available for this verse right now.</div>
                      ) : (
                        tafsirData.filter(t => t.author === 'Ibn Kathir').concat(tafsirData.filter(t => t.author !== 'Ibn Kathir')).slice(0, 1).map((tf, idx) => (
                          <div key={idx}>
                            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(212,175,110,0.6)', marginBottom: '6px', textTransform: 'uppercase' }}>{tf.author}</div>
                            <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: tf.content.slice(0, 800) + (tf.content.length > 800 ? '…' : '') }}/>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
          Text and translations are provided by third-party sources and are offered for reading and reflection, not as a substitute for scholarly guidance.
        </p>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .quran-reader-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
