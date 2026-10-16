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

// Overridable ONLY so the reader can be pointed at a fixture server during
// verification. Leave it unset everywhere else — in production this must be
// the real upstream, and nothing in the app sets it.
const API = process.env.QURAN_API_BASE || 'https://api.quran.com/api/v4'

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

// ── Translation: Saheeh International, and only that ─────────────────────
// There is no picker. One translation keeps the reader simple and means a
// verse always reads the same way for everyone discussing it.
//
// Resolved by NAME at runtime, like the tafsir below, so an upstream
// renumbering cannot silently swap in a different translation. The numeric
// id is only the last resort.
const FALLBACK_SAHEEH = 20 // Saheeh International
export const TRANSLATION_NAME = 'Saheeh International'

export type Resource = { id: number; name: string; author: string }

let saheehIdCache: number | null = null

export async function getTranslationId(): Promise<number> {
  if (saheehIdCache) return saheehIdCache
  try {
    const data = await get('/resources/translations?language=en', RESOURCES)
    const all: any[] = data?.translations || []
    const hit = all.find(t => {
      const lang = (t.language_name || '').toLowerCase()
      const hay = `${t.name || ''} ${t.author_name || ''} ${t.slug || ''}`
      return lang === 'english' && /saheeh|sahih/i.test(hay) && /international/i.test(hay)
    })
    saheehIdCache = hit?.id ?? FALLBACK_SAHEEH
  } catch {
    saheehIdCache = FALLBACK_SAHEEH
  }
  return saheehIdCache!
}

// Kept so the reader can label what it is showing without a second call.
export async function getTranslations(): Promise<Resource[]> {
  const id = await getTranslationId()
  return [{ id, name: TRANSLATION_NAME, author: TRANSLATION_NAME }]
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
  uthmani: string     // Uthmani script, bismillah NOT included, marker removed
  numeral: string     // the ayah number in Arabic-Indic digits, e.g. "٢٥٥"
  translation: string // plain text, footnote markers stripped
}

// ── Splitting the ayah marker off the verse ──────────────────────────────
// text_qpc_hafs ends each verse with its Arabic-Indic number, the way the
// printed page does. To draw that number inside the traditional ornament,
// the UI needs it as a value of its own — so it is separated here, and the
// separation is ASSERTED rather than assumed:
//
//   • the suffix must be nothing but Arabic-Indic digits
//   • what remains must still be non-empty
//
// If either check fails we throw instead of guessing. This does not touch a
// single Quranic word: ayah numbering is the mushaf's apparatus, not part of
// the revealed text, and the digits are provably just digits.
const AYAH_MARKER = /\s*([٠-٩]+)\s*$/

export function splitAyahMarker(text: string, key: string): { body: string; numeral: string } {
  const m = text.match(AYAH_MARKER)
  if (!m || m.index === undefined) {
    throw new Error(`No ayah marker at the end of ${key} — upstream shape changed`)
  }
  const body = text.slice(0, m.index).trim()
  if (!body) throw new Error(`Verse ${key} contains nothing but an ayah marker`)
  return { body, numeral: m[1] }
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

// ── Which text field, and why it matters ─────────────────────────────────
// `text_qpc_hafs` is the King Fahd Complex's own digitisation of the Madinah
// mushaf, and it is the text the official UthmanicHafs font is cut for. The
// other candidate, `text_uthmani`, carries the same words but in modern typed
// forms: a round sukun (U+0652) where the mushaf uses the small dotless head
// of khah (U+06E1), a tatweel (U+0640) padded in before every superscript
// alef, and ordinary tanwin where the mushaf uses the inverted damma.
// Rendered, that reads as keyboard Arabic rather than a mushaf page.
//
// Do not "simplify" this back to text_uthmani, and do not mix the two —
// the font and the text are a matched pair.
//
// Note: text_qpc_hafs ends each verse with its Arabic-Indic ayah number, the
// way the printed page does. That marker is part of the supplied text and is
// rendered as-is; the UI must not add a second verse number to the Arabic
// line, and must not strip this one.
const QURAN_TEXT_FIELD = 'text_qpc_hafs' as const

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
      `/verses/by_chapter/${id}?fields=${QURAN_TEXT_FIELD}&translations=${translationId}` +
      `&per_page=${PER_PAGE}&page=${page}`,
      IMMUTABLE
    )
    const batch = data?.verses
    if (!Array.isArray(batch)) throw new Error('Unexpected verses payload')
    for (const v of batch) {
      const text = v[QURAN_TEXT_FIELD]
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error(`Missing ${QURAN_TEXT_FIELD} for ${v.verse_key}`)
      }
      const { body, numeral } = splitAyahMarker(text, v.verse_key)
      verses.push({
        number: v.verse_number,
        key: v.verse_key,
        uthmani: body,
        numeral,
        translation: plainText(v.translations?.[0]?.text || ''),
      })
    }
    totalPages = data?.pagination?.total_pages ?? 1
    page++
  } while (page <= totalPages)

  if (verses.length !== chapter.verses_count) {
    throw new Error(`Verse count mismatch for surah ${id}: got ${verses.length}, expected ${chapter.verses_count}`)
  }

  // ── The bismillah header ───────────────────────────────────────────────
  // Taken from verse 1:1 of Al-Fatihah in this same edition — never typed by
  // hand here. Because the verse text now ends with its ayah marker (١), we
  // take it WORD BY WORD instead of trimming the string: the API marks the
  // marker as its own word with char_type_name 'end', so selecting the
  // 'word' entries gives the bismillah with nothing edited or removed.
  //
  // On Al-Fatihah there is no header at all — there the bismillah IS ayah 1
  // in the Hafs numbering the printed mushaf uses (which is why the API
  // reports bismillah_pre: false and verses_count: 7 for surah 1).
  let bismillah = ''
  if (chapter.bismillah_pre && id !== 1) {
    const fatiha = await get(
      `/verses/by_chapter/1?words=true&word_fields=${QURAN_TEXT_FIELD}&per_page=1&page=1`,
      IMMUTABLE
    )
    const words = fatiha?.verses?.[0]?.words
    if (!Array.isArray(words)) throw new Error('Unexpected words payload for 1:1')
    const parts = words
      .filter((w: any) => w?.char_type_name === 'word')
      .map((w: any) => w?.[QURAN_TEXT_FIELD])
    if (parts.length !== 4 || parts.some((p: any) => typeof p !== 'string' || !p.trim())) {
      // Four words: بسم / الله / الرحمن / الرحيم. Anything else means the
      // upstream shape changed and we must not guess at it.
      throw new Error(`Unexpected bismillah word structure for 1:1 (got ${parts.length} words)`)
    }
    bismillah = parts.join(' ')
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
