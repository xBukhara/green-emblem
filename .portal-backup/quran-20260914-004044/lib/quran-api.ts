// ── Quran upstream (server-only) ─────────────────────────────────────────
// Source of truth: the Quran.com API v4 (api.quran.com) — the same API that
// powers quran.com itself.
//
// WHY THIS REPLACED alquran.cloud:
// The previous source served the `quran-uthmani` edition, which PREPENDS
// "بسم الله الرحمن الرحيم" onto the first ayah of nearly every surah. That
// is a property of that dataset, not a bug in our rendering — it made the
// first verse of most surahs textually wrong. Quran.com's API keeps the
// bismillah out of `text_uthmani` and signals it separately via the
// chapter's `bismillah_pre` flag, which is the correct separation.
//
// SAFETY RULE FOR THIS FILE: never synthesise, patch, or "repair" Quranic
// text in code. If the upstream response does not have the exact shape we
// expect, throw — the UI shows an honest error rather than rendering text
// we are not certain about.

const API = 'https://api.quran.com/api/v4'

// Quran text is immutable — cache hard.
const IMMUTABLE = { next: { revalidate: 60 * 60 * 24 * 30 } }   // 30 days
const RESOURCES = { next: { revalidate: 60 * 60 * 24 } }        // 1 day

async function get(path: string, init: RequestInit & { next?: any } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers || {}) },
  })
  if (!res.ok) throw new Error(`Quran API ${res.status} for ${path}`)
  return res.json()
}

// ── Chapters ─────────────────────────────────────────────────────────────

export type Chapter = {
  id: number
  name_simple: string
  name_arabic: string
  translated_name: string
  verses_count: number
  revelation_place: string
  bismillah_pre: boolean
}

export async function getChapters(): Promise<Chapter[]> {
  const data = await get('/chapters?language=en', RESOURCES)
  const chapters = data?.chapters
  if (!Array.isArray(chapters) || chapters.length !== 114) {
    throw new Error('Unexpected chapters payload')
  }
  return chapters.map((c: any) => ({
    id: c.id,
    name_simple: c.name_simple,
    name_arabic: c.name_arabic,
    translated_name: c.translated_name?.name || '',
    verses_count: c.verses_count,
    revelation_place: c.revelation_place,
    bismillah_pre: !!c.bismillah_pre,
  }))
}

// ── Resource discovery ───────────────────────────────────────────────────
// Resource IDs are resolved by NAME at runtime rather than hardcoded, so a
// renumbering upstream can't silently swap in the wrong tafsir or
// translation. The constants below are only a last-resort fallback.

const FALLBACK_IBN_KATHIR = 169
const FALLBACK_TRANSLATION = 131 // Dr. Mustafa Khattab — The Clear Quran

export type Resource = { id: number; name: string; author: string }

// A curated shortlist of widely-trusted English translations. Only the ones
// the upstream actually offers are shown, matched by author/name.
const PREFERRED_TRANSLATIONS: { match: RegExp; label: string }[] = [
  { match: /khattab/i,                     label: 'The Clear Quran — Dr. Mustafa Khattab' },
  { match: /saheeh|sahih/i,                label: 'Saheeh International' },
  { match: /taqi\s*usmani|usmani/i,        label: 'Mufti Taqi Usmani' },
  { match: /pickthall/i,                   label: 'Pickthall' },
  { match: /yusuf\s*ali/i,                 label: 'Abdullah Yusuf Ali' },
  { match: /hilali|muhsin\s*khan/i,        label: 'Hilali & Khan' },
]

export async function getTranslations(): Promise<Resource[]> {
  try {
    const data = await get('/resources/translations?language=en', RESOURCES)
    const all: any[] = data?.translations || []
    const english = all.filter(t => (t.language_name || '').toLowerCase() === 'english')

    const picked: Resource[] = []
    for (const pref of PREFERRED_TRANSLATIONS) {
      const hit = english.find(t =>
        pref.match.test(`${t.author_name || ''} ${t.name || ''}`) &&
        !picked.some(p => p.id === t.id)
      )
      if (hit) picked.push({ id: hit.id, name: pref.label, author: hit.author_name || '' })
    }
    return picked.length ? picked : [{ id: FALLBACK_TRANSLATION, name: 'The Clear Quran — Dr. Mustafa Khattab', author: 'Mustafa Khattab' }]
  } catch {
    return [{ id: FALLBACK_TRANSLATION, name: 'The Clear Quran — Dr. Mustafa Khattab', author: 'Mustafa Khattab' }]
  }
}

let ibnKathirIdCache: number | null = null

// Resolve the English Ibn Kathir tafsir by name — this is the ONLY tafsir
// the app exposes, matching how quran.com presents it.
export async function getIbnKathirId(): Promise<number> {
  if (ibnKathirIdCache) return ibnKathirIdCache
  try {
    const data = await get('/resources/tafsirs', RESOURCES)
    const all: any[] = data?.tafsirs || []
    const hit = all.find(t => {
      const lang = (t.language_name || '').toLowerCase()
      const hay = `${t.slug || ''} ${t.name || ''} ${t.author_name || ''} ${t.translated_name?.name || ''}`
      return lang === 'english' && /ibn\s*-?\s*kath/i.test(hay)
    })
    ibnKathirIdCache = hit?.id ?? FALLBACK_IBN_KATHIR
  } catch {
    ibnKathirIdCache = FALLBACK_IBN_KATHIR
  }
  return ibnKathirIdCache!
}

// ── Verses ───────────────────────────────────────────────────────────────

export type Verse = {
  number: number      // ayah number within the surah
  key: string         // "2:255"
  uthmani: string     // Uthmani script, bismillah NOT included
  translation: string // plain text, footnote markers stripped
}

export type SurahPayload = {
  chapter: Chapter
  showBismillah: boolean
  bismillah: string   // sourced from verse 1:1, never hand-typed
  verses: Verse[]
  translationId: number
}

// Strip the <sup foot_note="..."> markers and any other markup Quran.com
// embeds in translation strings, leaving clean readable prose.
function plainText(html: string): string {
  return String(html || '')
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const PER_PAGE = 50

export async function getSurah(id: number, translationId: number): Promise<SurahPayload> {
  if (!Number.isInteger(id) || id < 1 || id > 114) throw new Error('Invalid surah number')

  const chapters = await getChapters()
  const chapter = chapters.find(c => c.id === id)
  if (!chapter) throw new Error('Chapter not found')

  // Paginate through every verse — a truncated surah would be a
  // correctness failure, so we assert the final count matches.
  const verses: Verse[] = []
  let page = 1
  let totalPages = 1
  do {
    const data = await get(
      `/verses/by_chapter/${id}?fields=text_uthmani&translations=${translationId}` +
      `&per_page=${PER_PAGE}&page=${page}`,
      IMMUTABLE
    )
    const batch = data?.verses
    if (!Array.isArray(batch)) throw new Error('Unexpected verses payload')
    for (const v of batch) {
      if (typeof v.text_uthmani !== 'string' || !v.text_uthmani.trim()) {
        throw new Error(`Missing Uthmani text for ${v.verse_key}`)
      }
      verses.push({
        number: v.verse_number,
        key: v.verse_key,
        uthmani: v.text_uthmani,
        translation: plainText(v.translations?.[0]?.text || ''),
      })
    }
    totalPages = data?.pagination?.total_pages ?? 1
    page++
  } while (page <= totalPages)

  if (verses.length !== chapter.verses_count) {
    throw new Error(`Verse count mismatch for surah ${id}: got ${verses.length}, expected ${chapter.verses_count}`)
  }

  // The bismillah shown above a surah is taken verbatim from verse 1:1 of
  // Al-Fatihah in the same Uthmani edition — never typed by hand here.
  let bismillah = ''
  if (chapter.bismillah_pre) {
    if (id === 1) {
      bismillah = ''
    } else {
      const fatiha = await get(`/verses/by_chapter/1?fields=text_uthmani&per_page=1&page=1`, IMMUTABLE)
      bismillah = fatiha?.verses?.[0]?.text_uthmani || ''
    }
  }

  return {
    chapter,
    showBismillah: chapter.bismillah_pre && id !== 1,
    bismillah,
    verses,
    translationId,
  }
}

// ── Tafsir (Ibn Kathir, English — the only one exposed) ──────────────────

// Allow only inert formatting tags through from upstream HTML.
const ALLOWED_TAGS = /^(p|br|b|i|em|strong|h[1-6]|ul|ol|li|blockquote|span|div)$/i

function sanitize(html: string): string {
  return String(html || '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/<\s*\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (m, tag, attrs) => {
      if (!ALLOWED_TAGS.test(tag)) return ''
      // Drop every attribute (kills on* handlers, style, href/src entirely)
      return m.startsWith('</') ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`
    })
}

export async function getTafsir(verseKey: string): Promise<{ text: string; name: string } | null> {
  if (!/^\d{1,3}:\d{1,3}$/.test(verseKey)) throw new Error('Invalid verse key')
  const id = await getIbnKathirId()

  // Endpoint shape has varied across API revisions — try both, in order.
  const attempts = [
    `/tafsirs/${id}/by_ayah/${verseKey}`,
    `/quran/tafsirs/${id}?verse_key=${verseKey}`,
  ]
  for (const path of attempts) {
    try {
      const data = await get(path, IMMUTABLE)
      const text = data?.tafsir?.text ?? data?.tafsirs?.[0]?.text
      if (typeof text === 'string' && text.trim()) {
        return { text: sanitize(text), name: 'Tafsir Ibn Kathir' }
      }
    } catch { /* try the next shape */ }
  }
  return null
}
