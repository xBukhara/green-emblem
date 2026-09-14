#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  GREEN EMBLEM — QURAN TEXT & FONT CORRECTION
#
#  WHAT CHANGED
#   1. The reader now uses `text_qpc_hafs` — the King Fahd Complex's own
#      digitisation of the Madinah mushaf — instead of `text_uthmani`, which
#      spells the same words in modern typed forms (round sukun U+0652 where
#      the mushaf uses U+06E1, tatweel padding before every superscript alef,
#      ordinary tanwin instead of the inverted damma).
#   2. The official KFGQPC Uthmani Hafs font is now loaded, from the Quran
#      Foundation CDN with a self-hosted offline fallback. Before this,
#      public/fonts/ did not exist and the reader silently fell back to
#      Amiri Quran — a general Arabic face, not a mushaf face.
#   3. The app no longer composes any part of the Arabic line. The verse
#      number now comes from the supplied text, as the printed page does.
#
#  NOT A BUG, DO NOT "FIX": in Al-Fatihah the bismillah IS ayah 1. That is
#  the Hafs numbering every printed Madinah mushaf uses, which is why the
#  surah totals 7 ayahs and the API reports bismillah_pre: false for it.
#
#  Run from the root of your green-emblem project:
#      bash apply-quran-mushaf.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

if [ ! -f package.json ] || [ ! -d app ]; then
  echo "✗ Run this from the root of the green-emblem project."
  exit 1
fi

BACKUP=".portal-backup/quran-$(date +%Y%m%d-%H%M%S)"
echo "→ Backing up replaced files to $BACKUP"
save() {
  if [ -f "$1" ]; then mkdir -p "$BACKUP/$(dirname "$1")"; cp "$1" "$BACKUP/$1"; fi
  mkdir -p "$(dirname "$1")"
}

echo "  writing lib/quran-api.ts"
save 'lib/quran-api.ts'
cat > 'lib/quran-api.ts' <<'GE_EOF_3A62FE3B'
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
      verses.push({
        number: v.verse_number,
        key: v.verse_key,
        uthmani: text,
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
GE_EOF_3A62FE3B

echo "  writing lib/quran.ts"
save 'lib/quran.ts'
cat > 'lib/quran.ts' <<'GE_EOF_3411E57C'
// ── Quran client data layer ──────────────────────────────────────────────
// All Quranic text is fetched through our own /api/quran/* routes, which
// proxy the Quran.com API v4 (the API behind quran.com) with server-side
// caching. See lib/quran-api.ts for the upstream contract and the reason
// the previous source was replaced.
//
// Script is Uthmani only — there is deliberately no script picker.

export const SURAHS = [
  { number: 1, name: 'Al-Fatihah', arabicName: 'الفاتحة', ayahs: 7, type: 'Meccan' },
  { number: 2, name: 'Al-Baqarah', arabicName: 'البقرة', ayahs: 286, type: 'Medinan' },
  { number: 3, name: "Ali 'Imran", arabicName: 'آل عمران', ayahs: 200, type: 'Medinan' },
  { number: 4, name: 'An-Nisa', arabicName: 'النساء', ayahs: 176, type: 'Medinan' },
  { number: 5, name: "Al-Ma'idah", arabicName: 'المائدة', ayahs: 120, type: 'Medinan' },
  { number: 6, name: "Al-An'am", arabicName: 'الأنعام', ayahs: 165, type: 'Meccan' },
  { number: 7, name: "Al-A'raf", arabicName: 'الأعراف', ayahs: 206, type: 'Meccan' },
  { number: 8, name: 'Al-Anfal', arabicName: 'الأنفال', ayahs: 75, type: 'Medinan' },
  { number: 9, name: 'At-Tawbah', arabicName: 'التوبة', ayahs: 129, type: 'Medinan' },
  { number: 10, name: 'Yunus', arabicName: 'يونس', ayahs: 109, type: 'Meccan' },
  { number: 11, name: 'Hud', arabicName: 'هود', ayahs: 123, type: 'Meccan' },
  { number: 12, name: 'Yusuf', arabicName: 'يوسف', ayahs: 111, type: 'Meccan' },
  { number: 13, name: "Ar-Ra'd", arabicName: 'الرعد', ayahs: 43, type: 'Medinan' },
  { number: 14, name: 'Ibrahim', arabicName: 'ابراهيم', ayahs: 52, type: 'Meccan' },
  { number: 15, name: 'Al-Hijr', arabicName: 'الحجر', ayahs: 99, type: 'Meccan' },
  { number: 16, name: 'An-Nahl', arabicName: 'النحل', ayahs: 128, type: 'Meccan' },
  { number: 17, name: 'Al-Isra', arabicName: 'الإسراء', ayahs: 111, type: 'Meccan' },
  { number: 18, name: 'Al-Kahf', arabicName: 'الكهف', ayahs: 110, type: 'Meccan' },
  { number: 19, name: 'Maryam', arabicName: 'مريم', ayahs: 98, type: 'Meccan' },
  { number: 20, name: 'Taha', arabicName: 'طه', ayahs: 135, type: 'Meccan' },
  { number: 21, name: 'Al-Anbya', arabicName: 'الأنبياء', ayahs: 112, type: 'Meccan' },
  { number: 22, name: 'Al-Hajj', arabicName: 'الحج', ayahs: 78, type: 'Medinan' },
  { number: 23, name: "Al-Mu'minun", arabicName: 'المؤمنون', ayahs: 118, type: 'Meccan' },
  { number: 24, name: 'An-Nur', arabicName: 'النور', ayahs: 64, type: 'Medinan' },
  { number: 25, name: 'Al-Furqan', arabicName: 'الفرقان', ayahs: 77, type: 'Meccan' },
  { number: 26, name: "Ash-Shu'ara", arabicName: 'الشعراء', ayahs: 227, type: 'Meccan' },
  { number: 27, name: 'An-Naml', arabicName: 'النمل', ayahs: 93, type: 'Meccan' },
  { number: 28, name: 'Al-Qasas', arabicName: 'القصص', ayahs: 88, type: 'Meccan' },
  { number: 29, name: 'Al-Ankabut', arabicName: 'العنكبوت', ayahs: 69, type: 'Meccan' },
  { number: 30, name: 'Ar-Rum', arabicName: 'الروم', ayahs: 60, type: 'Meccan' },
  { number: 31, name: 'Luqman', arabicName: 'لقمان', ayahs: 34, type: 'Meccan' },
  { number: 32, name: 'As-Sajdah', arabicName: 'السجدة', ayahs: 30, type: 'Meccan' },
  { number: 33, name: 'Al-Ahzab', arabicName: 'الأحزاب', ayahs: 73, type: 'Medinan' },
  { number: 34, name: 'Saba', arabicName: 'سبأ', ayahs: 54, type: 'Meccan' },
  { number: 35, name: 'Fatir', arabicName: 'فاطر', ayahs: 45, type: 'Meccan' },
  { number: 36, name: 'Ya-Sin', arabicName: 'يس', ayahs: 83, type: 'Meccan' },
  { number: 37, name: 'As-Saffat', arabicName: 'الصافات', ayahs: 182, type: 'Meccan' },
  { number: 38, name: 'Sad', arabicName: 'ص', ayahs: 88, type: 'Meccan' },
  { number: 39, name: 'Az-Zumar', arabicName: 'الزمر', ayahs: 75, type: 'Meccan' },
  { number: 40, name: 'Ghafir', arabicName: 'غافر', ayahs: 85, type: 'Meccan' },
  { number: 41, name: 'Fussilat', arabicName: 'فصلت', ayahs: 54, type: 'Meccan' },
  { number: 42, name: 'Ash-Shuraa', arabicName: 'الشورى', ayahs: 53, type: 'Meccan' },
  { number: 43, name: 'Az-Zukhruf', arabicName: 'الزخرف', ayahs: 89, type: 'Meccan' },
  { number: 44, name: 'Ad-Dukhan', arabicName: 'الدخان', ayahs: 59, type: 'Meccan' },
  { number: 45, name: 'Al-Jathiyah', arabicName: 'الجاثية', ayahs: 37, type: 'Meccan' },
  { number: 46, name: 'Al-Ahqaf', arabicName: 'الأحقاف', ayahs: 35, type: 'Meccan' },
  { number: 47, name: 'Muhammad', arabicName: 'محمد', ayahs: 38, type: 'Medinan' },
  { number: 48, name: 'Al-Fath', arabicName: 'الفتح', ayahs: 29, type: 'Medinan' },
  { number: 49, name: 'Al-Hujurat', arabicName: 'الحجرات', ayahs: 18, type: 'Medinan' },
  { number: 50, name: 'Qaf', arabicName: 'ق', ayahs: 45, type: 'Meccan' },
  { number: 51, name: 'Adh-Dhariyat', arabicName: 'الذاريات', ayahs: 60, type: 'Meccan' },
  { number: 52, name: 'At-Tur', arabicName: 'الطور', ayahs: 49, type: 'Meccan' },
  { number: 53, name: 'An-Najm', arabicName: 'النجم', ayahs: 62, type: 'Meccan' },
  { number: 54, name: 'Al-Qamar', arabicName: 'القمر', ayahs: 55, type: 'Meccan' },
  { number: 55, name: 'Ar-Rahman', arabicName: 'الرحمن', ayahs: 78, type: 'Medinan' },
  { number: 56, name: "Al-Waqi'ah", arabicName: 'الواقعة', ayahs: 96, type: 'Meccan' },
  { number: 57, name: 'Al-Hadid', arabicName: 'الحديد', ayahs: 29, type: 'Medinan' },
  { number: 58, name: 'Al-Mujadila', arabicName: 'المجادلة', ayahs: 22, type: 'Medinan' },
  { number: 59, name: 'Al-Hashr', arabicName: 'الحشر', ayahs: 24, type: 'Medinan' },
  { number: 60, name: 'Al-Mumtahanah', arabicName: 'الممتحنة', ayahs: 13, type: 'Medinan' },
  { number: 61, name: 'As-Saf', arabicName: 'الصف', ayahs: 14, type: 'Medinan' },
  { number: 62, name: "Al-Jumu'ah", arabicName: 'الجمعة', ayahs: 11, type: 'Medinan' },
  { number: 63, name: 'Al-Munafiqun', arabicName: 'المنافقون', ayahs: 11, type: 'Medinan' },
  { number: 64, name: 'At-Taghabun', arabicName: 'التغابن', ayahs: 18, type: 'Medinan' },
  { number: 65, name: 'At-Talaq', arabicName: 'الطلاق', ayahs: 12, type: 'Medinan' },
  { number: 66, name: 'At-Tahrim', arabicName: 'التحريم', ayahs: 12, type: 'Medinan' },
  { number: 67, name: 'Al-Mulk', arabicName: 'الملك', ayahs: 30, type: 'Meccan' },
  { number: 68, name: 'Al-Qalam', arabicName: 'القلم', ayahs: 52, type: 'Meccan' },
  { number: 69, name: 'Al-Haqqah', arabicName: 'الحاقة', ayahs: 52, type: 'Meccan' },
  { number: 70, name: "Al-Ma'arij", arabicName: 'المعارج', ayahs: 44, type: 'Meccan' },
  { number: 71, name: 'Nuh', arabicName: 'نوح', ayahs: 28, type: 'Meccan' },
  { number: 72, name: 'Al-Jinn', arabicName: 'الجن', ayahs: 28, type: 'Meccan' },
  { number: 73, name: 'Al-Muzzammil', arabicName: 'المزمل', ayahs: 20, type: 'Meccan' },
  { number: 74, name: 'Al-Muddaththir', arabicName: 'المدثر', ayahs: 56, type: 'Meccan' },
  { number: 75, name: 'Al-Qiyamah', arabicName: 'القيامة', ayahs: 40, type: 'Meccan' },
  { number: 76, name: 'Al-Insan', arabicName: 'الانسان', ayahs: 31, type: 'Medinan' },
  { number: 77, name: 'Al-Mursalat', arabicName: 'المرسلات', ayahs: 50, type: 'Meccan' },
  { number: 78, name: 'An-Naba', arabicName: 'النبأ', ayahs: 40, type: 'Meccan' },
  { number: 79, name: "An-Nazi'at", arabicName: 'النازعات', ayahs: 46, type: 'Meccan' },
  { number: 80, name: 'Abasa', arabicName: 'عبس', ayahs: 42, type: 'Meccan' },
  { number: 81, name: 'At-Takwir', arabicName: 'التكوير', ayahs: 29, type: 'Meccan' },
  { number: 82, name: 'Al-Infitar', arabicName: 'الإنفطار', ayahs: 19, type: 'Meccan' },
  { number: 83, name: 'Al-Mutaffifin', arabicName: 'المطففين', ayahs: 36, type: 'Meccan' },
  { number: 84, name: 'Al-Inshiqaq', arabicName: 'الإنشقاق', ayahs: 25, type: 'Meccan' },
  { number: 85, name: 'Al-Buruj', arabicName: 'البروج', ayahs: 22, type: 'Meccan' },
  { number: 86, name: 'At-Tariq', arabicName: 'الطارق', ayahs: 17, type: 'Meccan' },
  { number: 87, name: "Al-A'la", arabicName: 'الأعلى', ayahs: 19, type: 'Meccan' },
  { number: 88, name: 'Al-Ghashiyah', arabicName: 'الغاشية', ayahs: 26, type: 'Meccan' },
  { number: 89, name: 'Al-Fajr', arabicName: 'الفجر', ayahs: 30, type: 'Meccan' },
  { number: 90, name: 'Al-Balad', arabicName: 'البلد', ayahs: 20, type: 'Meccan' },
  { number: 91, name: 'Ash-Shams', arabicName: 'الشمس', ayahs: 15, type: 'Meccan' },
  { number: 92, name: 'Al-Layl', arabicName: 'الليل', ayahs: 21, type: 'Meccan' },
  { number: 93, name: 'Ad-Duhaa', arabicName: 'الضحى', ayahs: 11, type: 'Meccan' },
  { number: 94, name: 'Ash-Sharh', arabicName: 'الشرح', ayahs: 8, type: 'Meccan' },
  { number: 95, name: 'At-Tin', arabicName: 'التين', ayahs: 8, type: 'Meccan' },
  { number: 96, name: "Al-'Alaq", arabicName: 'العلق', ayahs: 19, type: 'Meccan' },
  { number: 97, name: 'Al-Qadr', arabicName: 'القدر', ayahs: 5, type: 'Meccan' },
  { number: 98, name: 'Al-Bayyinah', arabicName: 'البينة', ayahs: 8, type: 'Medinan' },
  { number: 99, name: 'Az-Zalzalah', arabicName: 'الزلزلة', ayahs: 8, type: 'Medinan' },
  { number: 100, name: "Al-'Adiyat", arabicName: 'العاديات', ayahs: 11, type: 'Meccan' },
  { number: 101, name: "Al-Qari'ah", arabicName: 'القارعة', ayahs: 11, type: 'Meccan' },
  { number: 102, name: 'At-Takathur', arabicName: 'التكاثر', ayahs: 8, type: 'Meccan' },
  { number: 103, name: "Al-'Asr", arabicName: 'العصر', ayahs: 3, type: 'Meccan' },
  { number: 104, name: 'Al-Humazah', arabicName: 'الهمزة', ayahs: 9, type: 'Meccan' },
  { number: 105, name: 'Al-Fil', arabicName: 'الفيل', ayahs: 5, type: 'Meccan' },
  { number: 106, name: 'Quraysh', arabicName: 'قريش', ayahs: 4, type: 'Meccan' },
  { number: 107, name: "Al-Ma'un", arabicName: 'الماعون', ayahs: 7, type: 'Meccan' },
  { number: 108, name: 'Al-Kawthar', arabicName: 'الكوثر', ayahs: 3, type: 'Meccan' },
  { number: 109, name: 'Al-Kafirun', arabicName: 'الكافرون', ayahs: 6, type: 'Meccan' },
  { number: 110, name: 'An-Nasr', arabicName: 'النصر', ayahs: 3, type: 'Medinan' },
  { number: 111, name: 'Al-Masad', arabicName: 'المسد', ayahs: 5, type: 'Meccan' },
  { number: 112, name: 'Al-Ikhlas', arabicName: 'الإخلاص', ayahs: 4, type: 'Meccan' },
  { number: 113, name: 'Al-Falaq', arabicName: 'الفلق', ayahs: 5, type: 'Meccan' },
  { number: 114, name: 'An-Nas', arabicName: 'الناس', ayahs: 6, type: 'Meccan' },
] as const

export type Chapter = {
  id: number
  name_simple: string
  name_arabic: string
  translated_name: string
  verses_count: number
  revelation_place: string
  bismillah_pre: boolean
}

export type Verse = { number: number; key: string; uthmani: string; translation: string }

export type SurahPayload = {
  chapter: Chapter
  showBismillah: boolean
  bismillah: string
  verses: Verse[]
  translationId: number
}

export type TranslationOption = { id: number; name: string; author: string }

// Quran.com's own default translation.
export const DEFAULT_TRANSLATION_ID = 131

export async function fetchChapters(): Promise<Chapter[] | null> {
  try {
    const res = await fetch('/api/quran/chapters')
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json.chapters) ? json.chapters : null
  } catch {
    return null
  }
}

export async function fetchTranslations(): Promise<TranslationOption[]> {
  try {
    const res = await fetch('/api/quran/translations')
    if (!res.ok) return []
    const json = await res.json()
    return json.translations || []
  } catch {
    return []
  }
}

// Returns null on ANY failure — the reader then shows an honest error.
// It must never render partial or uncertain Quranic text.
export async function fetchSurah(id: number, translationId: number): Promise<SurahPayload | null> {
  try {
    const res = await fetch(`/api/quran/surah/${id}?translation=${translationId}`)
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.verses?.length) return null
    return json as SurahPayload
  } catch {
    return null
  }
}

export async function fetchTafsir(surah: number, ayah: number): Promise<{ text: string; name: string } | null> {
  try {
    const res = await fetch(`/api/quran/tafsir/${surah}/${ayah}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.tafsir || null
  } catch {
    return null
  }
}

// The end-of-ayah marker used to be composed here, in JavaScript, from the
// verse number. It is deliberately gone: `text_qpc_hafs` already carries the
// mushaf's own marker, and no part of the Arabic line should be assembled by
// this app. If you find yourself needing this function again, that is a sign
// something is rendering the wrong text field.
GE_EOF_3411E57C

echo "  writing components/QuranReader.tsx"
save 'components/QuranReader.tsx'
cat > 'components/QuranReader.tsx' <<'GE_EOF_FAD20D6F'
'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  SURAHS, fetchChapters, fetchTranslations, fetchSurah, fetchTafsir,
  DEFAULT_TRANSLATION_ID,
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

                {/* ── The verse, exactly as the Complex supplies it ──────────
                    text_qpc_hafs already ends with the mushaf's own
                    end-of-ayah marker (١ ٢ ٣ …), so nothing is appended here.
                    This used to draw a circled numeral built in JS from the
                    verse number, which would now double the number and would
                    mean the app was composing part of the Arabic line itself.
                    Render the supplied string and nothing else. */}
                <p style={{ ...UTHMANI, fontSize: '30px', color: '#f5f0e6', margin: '0 0 16px' }} dir="rtl" lang="ar">
                  {v.uthmani}
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
GE_EOF_FAD20D6F

echo "  writing app/globals.css"
save 'app/globals.css'
cat > 'app/globals.css' <<'GE_EOF_4DFA49B1'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── shadcn/ui semantic tokens, mapped to the Green Emblem palette ──────
   Values are HSL triplets (no hsl() wrapper) so Tailwind can compose them
   with opacity modifiers, e.g. bg-primary/10. */
@layer base {
  :root {
    --background:            120 44% 14%;   /* #143314 forest        */
    --foreground:            40 43% 93%;    /* #f5f0e6 cream         */
    --card:                  120 40% 18%;   /* #1b3f1b               */
    --card-foreground:       40 43% 93%;
    --popover:               120 45% 10%;   /* #0e250e               */
    --popover-foreground:    40 43% 93%;
    --primary:               38 54% 63%;    /* #d4af6e gold          */
    --primary-foreground:    120 45% 10%;
    --secondary:             120 37% 22%;   /* #234c23               */
    --secondary-foreground:  40 43% 93%;
    --muted:                 120 22% 22%;
    --muted-foreground:      120 6% 72%;
    --accent:                120 40% 30%;   /* #2e6b2e forest green  */
    --accent-foreground:     40 43% 93%;
    --destructive:           1 65% 55%;
    --destructive-foreground:40 43% 93%;
    --border:                38 28% 32%;
    --input:                 120 25% 26%;
    --ring:                  38 54% 63%;
    --radius: 0.75rem;
  }

  /* Tailwind's border utilities assume preflight's border defaults.
     Preflight is off here, so supply exactly those three declarations —
     and `border-width: 0` is NOT optional: the CSS initial width is
     `medium` (3px), so setting only `border-style: solid` paints a 3px
     border around every element on the page. Inline styles and class
     rules both outrank `*`, so the not-yet-migrated pages are untouched. */
  *, ::before, ::after {
    border-width: 0;
    border-style: solid;
    border-color: hsl(var(--border));
  }
}

/* ── RESET ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

/* ── BRAND TOKENS ── */
:root {
  --forest:        #2e6b2e;
  --forest-deep:   #1b3f1b;   /* card / raised surface */
  --forest-dark:   #143314;   /* page background — lighter than the old #0f1f0f */
  --forest-deepest:#0e250e;   /* nav, footer, deepest chrome */
  --forest-raised: #234c23;
  --forest-mid:   #3a7a3a;
  --forest-light: #5a9e5a;
  --gold:         #d4af6e;
  --gold-light:   #f0d48a;
  --gold-dim:     #a07840;
  --gold-glow:    rgba(212,175,110,0.12);
  --cream:        #f5f0e6;
  --cream-dim:    #e8e0cc;
  --w90: rgba(255,255,255,0.90);
  --w60: rgba(255,255,255,0.60);
  --w35: rgba(255,255,255,0.35);
  --w15: rgba(255,255,255,0.15);
  --w08: rgba(255,255,255,0.08);
  --w04: rgba(255,255,255,0.04);
  --font-cinzel:    var(--font-cinzel), 'Palatino Linotype', serif;
  --font-cormorant: var(--font-cormorant), Georgia, serif;
  --font-arabic:    var(--font-arabic), serif;
  /* Quranic script stack — see @font-face below */
  --font-uthmani:   'KFGQPC Uthmanic Script HAFS', var(--font-amiri-quran), var(--font-arabic), serif;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

/* ── QURANIC SCRIPT ────────────────────────────────────────────────────
   The official King Fahd Glorious Quran Printing Complex face, cut for the
   `text_qpc_hafs` text the reader now uses. The two are a matched pair: this
   font positions the mushaf marks (the dotless-head-of-khah sukun, the
   inverted-damma tanwin, superscript alef, the waqf signs) correctly, which
   a general-purpose Arabic face does not.

   Loaded from the Quran Foundation's CDN first, because they periodically
   ship corrections to the font and we want those. The self-hosted copy is
   the fallback so the reader still renders offline (the service worker
   caches whichever one wins) and if their CDN is ever unreachable.

   To populate the local fallback: bash scripts/fetch-quran-font.sh
   Do NOT delete the Amiri Quran tail of the stack — it is the last resort
   if both fail, and it renders the marks legibly even if not like a mushaf. */
@font-face {
  font-family: 'KFGQPC Uthmanic Script HAFS';
  src: url('https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2') format('woff2'),
       url('/fonts/UthmanicHafs1Ver18.woff2') format('woff2'),
       url('/fonts/UthmanicHafs.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* ── BASE ── */
body {
  background: var(--forest-dark);
  color: #fff;
  font-family: var(--font-cormorant);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ── LINKS ──
   Links read white by default across the site; gold is reserved for
   headings, CTAs, icons and active indicators. */
a { color: #fff; }
a:hover { color: var(--gold-light); }

/* ── TYPOGRAPHY HELPERS ── */
.font-cinzel    { font-family: var(--font-cinzel); }
.font-cormorant { font-family: var(--font-cormorant); }
.font-arabic    { font-family: var(--font-arabic); direction: rtl; }

/* ── SHARED BUTTON STYLES ── */
.btn-gold {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-cinzel); font-size: 11px; letter-spacing: 0.16em;
  color: var(--forest-dark); background: var(--gold);
  border: none; border-radius: 8px; padding: 14px 28px;
  cursor: pointer; text-decoration: none;
  transition: opacity 0.18s, transform 0.18s var(--ease);
}
.btn-gold:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-gold:active { transform: translateY(0); }

.btn-outline {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-cinzel); font-size: 11px; letter-spacing: 0.16em;
  color: var(--gold); background: transparent;
  border: 0.5px solid rgba(212,175,110,0.5); border-radius: 8px; padding: 14px 28px;
  cursor: pointer; text-decoration: none;
  transition: all 0.18s var(--ease);
}
.btn-outline:hover { background: var(--gold-glow); border-color: var(--gold); transform: translateY(-1px); }

/* ── BACKGROUND TILE PATTERN ── */
.bg-tile {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cg fill='none' stroke='%23d4af6e' stroke-width='0.7'%3E%3Crect x='25' y='25' width='50' height='50' rx='3'/%3E%3Crect x='25' y='25' width='50' height='50' rx='3' transform='rotate(45 50 50)'/%3E%3C/g%3E%3C/svg%3E");
}

/* ── PAGE WRAPPER ── */
.page-wrap {
  position: relative; z-index: 2;
  min-height: 100dvh;
}

/* ── ANIMATIONS ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes shimmer {
  0%   { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -300; }
}

.fade-up { opacity: 0; animation: fadeUp 0.7s var(--ease) forwards; }
.reveal  {
  opacity: 0; transform: translateY(28px);
  transition: opacity 0.7s var(--ease), transform 0.7s var(--ease);
}
.reveal.visible { opacity: 1; transform: translateY(0); }

/* ── FORM INPUTS ── */
.ge-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 0.5px solid rgba(212,175,110,0.18);
  border-radius: 8px;
  padding: 12px 14px;
  font-family: var(--font-cormorant);
  font-size: 16px;
  color: #fff;
  outline: none;
  transition: border-color 0.2s;
  appearance: none;
  -webkit-appearance: none;
}
.ge-input::placeholder { color: var(--w35); font-style: italic; }
.ge-input:focus { border-color: rgba(212,175,110,0.5); }

/* ── SURFACE CARD ── */
.ge-card {
  background: rgba(27,63,27,0.72);
  border: 0.5px solid rgba(212,175,110,0.15);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* ── PILL / BADGE ── */
.ge-pill {
  display: inline-block;
  font-family: var(--font-cinzel);
  font-size: 8.5px; letter-spacing: 0.14em;
  padding: 3px 10px; border-radius: 100px;
}
.ge-pill-gold   { background: var(--gold-glow); color: var(--gold); border: 0.5px solid rgba(212,175,110,0.3); }
.ge-pill-green  { background: rgba(46,107,46,0.12); color: var(--forest-light); border: 0.5px solid rgba(46,107,46,0.3); }
.ge-pill-red    { background: rgba(226,75,74,0.08); color: #e24b4a; border: 0.5px solid rgba(226,75,74,0.2); }
.ge-pill-gray   { background: var(--w04); color: var(--w60); border: 0.5px solid var(--w15); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

/* ── HOMEPAGE PILLAR CARDS ── */
.pillar-card:hover {
  border-color: rgba(212,175,110,0.35) !important;
  transform: translateY(-3px);
}

/* ════════════════════════════════════════════════════════════════
   2026 REFRESH — readable UI type, modern interaction layer
   ════════════════════════════════════════════════════════════════ */

:root {
  --font-inter: var(--font-inter), -apple-system, 'Segoe UI', sans-serif;
}

/* Readable body text: Inter for UI copy; Cormorant stays for quotes,
   verses and editorial italics via .font-cormorant */
body {
  font-family: var(--font-inter);
  font-size: 15px;
  line-height: 1.65;
  letter-spacing: 0.005em;
}

p, li, td, input, textarea, select, button, label {
  font-family: inherit;
}

/* Editorial accents keep the serif voice */
.serif-quote {
  font-family: var(--font-cormorant);
  font-style: italic;
}

/* ── Interactive layer ── */
a, button { -webkit-tap-highlight-color: transparent; }

:focus-visible {
  outline: 2px solid rgba(212,175,110,0.7);
  outline-offset: 2px;
  border-radius: 4px;
}

.hover-lift {
  transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), border-color 0.25s var(--ease);
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.35), 0 0 24px rgba(212,175,110,0.06);
  border-color: rgba(212,175,110,0.4) !important;
}

.btn-gold, .btn-outline {
  font-size: 12px;
  border-radius: 10px;
  position: relative;
  overflow: hidden;
}
.btn-gold::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%);
  transform: translateX(-120%);
  transition: transform 0.6s var(--ease);
}
.btn-gold:hover::after { transform: translateX(120%); }

/* Skeleton shimmer for loading states */
.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: skeletonWave 1.4s ease infinite;
  border-radius: 8px;
}
@keyframes skeletonWave {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Step transition for wizards */
@keyframes stepIn {
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: translateX(0); }
}
.step-in { animation: stepIn 0.35s var(--ease); }

/* Staggered reveal children */
.reveal-stagger > * { opacity: 0; transform: translateY(24px); transition: opacity 0.6s var(--ease), transform 0.6s var(--ease); }
.reveal-stagger.visible > * { opacity: 1; transform: translateY(0); }
.reveal-stagger.visible > *:nth-child(1) { transition-delay: 0.00s; }
.reveal-stagger.visible > *:nth-child(2) { transition-delay: 0.08s; }
.reveal-stagger.visible > *:nth-child(3) { transition-delay: 0.16s; }
.reveal-stagger.visible > *:nth-child(4) { transition-delay: 0.24s; }

/* Range slider (design studio) */
input[type="range"].ge-range {
  appearance: none; -webkit-appearance: none;
  width: 100%; height: 3px; border-radius: 2px;
  background: rgba(212,175,110,0.25);
  outline: none;
}
input[type="range"].ge-range::-webkit-slider-thumb {
  appearance: none; -webkit-appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--gold); cursor: pointer;
  border: 2px solid #0f1f0f;
}

/* Color swatch input */
input[type="color"].ge-color {
  appearance: none; -webkit-appearance: none;
  width: 34px; height: 34px; border: none; border-radius: 8px;
  background: none; cursor: pointer; padding: 0;
}
input[type="color"].ge-color::-webkit-color-swatch-wrapper { padding: 2px; }
input[type="color"].ge-color::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; }
GE_EOF_4DFA49B1

echo "  writing public/sw.js"
save 'public/sw.js'
cat > 'public/sw.js' <<'GE_EOF_4A4B0ECC'
/* Green Emblem service worker — push notifications + a light offline shell.
 *
 * Deliberately conservative about caching: this app's value is live data
 * (prayer times, events, the Quran API), and a stale cache is worse than a
 * spinner. We cache only the app shell and static assets, always try the
 * network first for pages, and never cache API responses.
 */

const VERSION = 'ge-v2'
const SHELL_CACHE = `${VERSION}-shell`
const FONT_CACHE = `${VERSION}-fonts`
const OFFLINE_URL = '/offline.html'

// The Uthmani mushaf font. Cached cross-origin on purpose: without it the
// Quran falls back to a general Arabic face that does not place the mushaf
// marks properly, which for Quranic text is a correctness problem, not a
// cosmetic one. Fonts are versioned in their filename, so cache-first is safe.
const FONT_HOSTS = ['verses.quran.foundation']
const isQuranFont = url =>
  (FONT_HOSTS.includes(url.hostname) && url.pathname.includes('/fonts/quran/')) ||
  (url.origin === self.location.origin && /^\/fonts\/.*\.(woff2?|ttf)$/.test(url.pathname))

const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/badge-96.png',
  '/manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // never block install on a cache miss
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// Network-first for navigations, with an offline page as the last resort.
// Everything else falls through to the network untouched.
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  // Quran font: cache-first, so the mushaf renders offline once seen.
  const url = new URL(request.url)
  if (isQuranFont(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE)
      const hit = await cache.match(request)
      if (hit) return hit
      try {
        const res = await fetch(request)
        // Never store an error page or an opaque response as the font.
        if (res.ok && res.type !== 'opaque') cache.put(request, res.clone())
        return res
      } catch (err) {
        return hit || Response.error()
      }
    })())
    return
  }

  if (url.origin !== self.location.origin) return
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL)
      return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    })
  )
})

// ── Push ────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Green Emblem', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Green Emblem'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: payload.tag || 'green-emblem',
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    silent: !!payload.silent,
    timestamp: payload.timestamp || Date.now(),
    data: { url: payload.url || '/', ...(payload.data || {}) },
    actions: payload.actions || [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Focus an existing tab if one is open rather than piling up new ones.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

// If the browser rotates the subscription, tell the server so pushes keep
// arriving instead of silently dying.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
      if (!applicationServerKey) return
      const fresh = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: fresh, rotatedFrom: event.oldSubscription?.endpoint }),
      })
    } catch {}
  })())
})
GE_EOF_4A4B0ECC

echo "  writing scripts/verify-quran.mjs"
save 'scripts/verify-quran.mjs'
cat > 'scripts/verify-quran.mjs' <<'GE_EOF_65CF9DA7'
#!/usr/bin/env node
// Verify the LIVE Quran data served by the deployed app.
//
//   node scripts/verify-quran.mjs                      (checks green-emblem.com)
//   node scripts/verify-quran.mjs http://localhost:3000
//
// This exists because Quranic text correctness cannot be assumed. It checks
// the exact failure that prompted the rewrite — bismillah being merged into
// the first verse — plus verse counts and structure across a sample of
// surahs, against the real upstream.

const BASE = (process.argv[2] || 'https://green-emblem.com').replace(/\/$/, '')

// Detecting the bismillah by matching a fully-vowelled string is brittle: it
// broke the moment the reader moved from `text_uthmani` to `text_qpc_hafs`,
// because the mushaf spells the sukun with U+06E1 (ۡ) rather than the modern
// U+0652 (ْ). So strip every combining mark first and compare letters only.
// This is for verification, never for display — nothing here feeds the UI.
const MARKS = /[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/gu
// Fold alef variants onto plain alef, or "\u0671\u0644\u0644\u0647" will not match "\u0627\u0644\u0644\u0647".
const stripMarks = s => (s || '').replace(MARKS, '').replace(/[\u0622\u0623\u0625\u0671]/gu, '\u0627')
const startsWithBismillah = s =>
  stripMarks(s).replace(/\s+/g, ' ').trim().startsWith('بسم الله')

let pass = 0, fail = 0
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log('  \x1b[32mPASS\x1b[0m', name) }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m', name, extra ? `\n       → ${extra}` : '') }
}

async function surah(n, translation = 131) {
  const res = await fetch(`${BASE}/api/quran/surah/${n}?translation=${translation}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for surah ${n}`)
  return res.json()
}

// number of verses per surah — the canonical Hafs counts
const COUNTS = { 1: 7, 2: 286, 9: 129, 18: 110, 36: 83, 55: 78, 108: 3, 112: 4, 114: 6 }

const run = async () => {
  console.log(`\nVerifying Quran data at ${BASE}\n`)

  console.log('[1] Bismillah must NOT be merged into the first verse')
  for (const n of [2, 18, 36, 55, 112, 114]) {
    const s = await surah(n)
    const first = s.verses[0].uthmani
    check(`surah ${n} verse 1 is clean`, !startsWithBismillah(first), first.slice(0, 60))
  }

  console.log('\n[2] Bismillah is served separately where it belongs')
  const s2 = await surah(2)
  check('surah 2 flags a bismillah header', s2.showBismillah === true)
  check('surah 2 header text is the bismillah', startsWithBismillah(s2.bismillah), s2.bismillah)

  const s1 = await surah(1)
  check('Al-Fatihah has NO separate header (it is verse 1)', s1.showBismillah === false)
  check('Al-Fatihah verse 1 IS the bismillah', startsWithBismillah(s1.verses[0].uthmani), s1.verses[0].uthmani)

  const s9 = await surah(9)
  check('At-Tawbah has no bismillah at all', s9.showBismillah === false)
  check('At-Tawbah verse 1 is clean', !startsWithBismillah(s9.verses[0].uthmani), s9.verses[0].uthmani)

  console.log('\n[3] Verse counts (nothing truncated by pagination)')
  for (const [n, expected] of Object.entries(COUNTS)) {
    const s = await surah(Number(n))
    check(`surah ${n} has ${expected} verses`, s.verses.length === expected, `got ${s.verses.length}`)
    check(`surah ${n} last key is ${n}:${expected}`, s.verses[expected - 1].key === `${n}:${expected}`)
  }

  console.log('\n[4] Every verse has Arabic text and a translation')
  for (const n of [2, 36, 112]) {
    const s = await surah(n)
    check(`surah ${n}: no empty Arabic`, s.verses.every(v => v.uthmani && v.uthmani.trim().length > 0))
    check(`surah ${n}: no empty translation`, s.verses.every(v => v.translation && v.translation.trim().length > 0))
    check(`surah ${n}: no leftover HTML in translation`, s.verses.every(v => !/[<>]/.test(v.translation)))
  }

  console.log('\n[5] Tafsir is Ibn Kathir, in English')
  const tRes = await fetch(`${BASE}/api/quran/tafsir/2/255`)
  const tJson = await tRes.json()
  check('tafsir returned for Ayat al-Kursi', !!tJson.tafsir?.text, JSON.stringify(tJson).slice(0, 120))
  if (tJson.tafsir?.text) {
    check('tafsir is labelled Ibn Kathir', /ibn\s*kathir/i.test(tJson.tafsir.name))
    check('tafsir contains no <script>', !/<script/i.test(tJson.tafsir.text))
  }

  console.log(`\n${fail === 0 ? '\x1b[32mALL CHECKS PASSED\x1b[0m' : `\x1b[31m${fail} CHECK(S) FAILED\x1b[0m`}  (${pass} passed)\n`)
  process.exit(fail ? 1 : 0)
}

run().catch(e => { console.error('\n\x1b[31mVerification could not complete:\x1b[0m', e.message, '\n'); process.exit(1) })
GE_EOF_65CF9DA7

echo "  writing scripts/audit-quran-text.mjs"
save 'scripts/audit-quran-text.mjs'
cat > 'scripts/audit-quran-text.mjs' <<'GE_EOF_9328AB98'
#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
 * Character-level audit of the Quranic text the app renders.
 *
 *   node scripts/audit-quran-text.mjs            # assertion suite
 *   node scripts/audit-quran-text.mjs 1          # every char of surah 1
 *   node scripts/audit-quran-text.mjs 2:255      # one verse
 *   node scripts/audit-quran-text.mjs 1 --compare  # qpc_hafs vs uthmani
 *
 * This exists so the text can be checked against a physical mushaf without
 * taking anyone's word for it. It prints every single codepoint with its
 * Unicode name, so a mark that is present, absent, or of the wrong kind is
 * visible rather than inferred.
 *
 * It talks to api.quran.com directly — the same upstream the app uses — so
 * run it from a machine with normal internet access.
 * ═══════════════════════════════════════════════════════════════════════ */

const API = 'https://api.quran.com/api/v4'
const FIELD = 'text_qpc_hafs'

// ── Unicode names for everything that appears in Quranic text ────────────
// Hand-tabulated rather than guessed. Anything outside this table is printed
// as a bare codepoint and called out, so an unexpected character cannot hide.
const NAMES = {
  0x0020: 'SPACE',
  0x0621: 'ARABIC LETTER HAMZA', 0x0622: 'ARABIC LETTER ALEF WITH MADDA ABOVE',
  0x0623: 'ARABIC LETTER ALEF WITH HAMZA ABOVE', 0x0624: 'ARABIC LETTER WAW WITH HAMZA ABOVE',
  0x0625: 'ARABIC LETTER ALEF WITH HAMZA BELOW', 0x0626: 'ARABIC LETTER YEH WITH HAMZA ABOVE',
  0x0627: 'ARABIC LETTER ALEF', 0x0628: 'ARABIC LETTER BEH', 0x0629: 'ARABIC LETTER TEH MARBUTA',
  0x062A: 'ARABIC LETTER TEH', 0x062B: 'ARABIC LETTER THEH', 0x062C: 'ARABIC LETTER JEEM',
  0x062D: 'ARABIC LETTER HAH', 0x062E: 'ARABIC LETTER KHAH', 0x062F: 'ARABIC LETTER DAL',
  0x0630: 'ARABIC LETTER THAL', 0x0631: 'ARABIC LETTER REH', 0x0632: 'ARABIC LETTER ZAIN',
  0x0633: 'ARABIC LETTER SEEN', 0x0634: 'ARABIC LETTER SHEEN', 0x0635: 'ARABIC LETTER SAD',
  0x0636: 'ARABIC LETTER DAD', 0x0637: 'ARABIC LETTER TAH', 0x0638: 'ARABIC LETTER ZAH',
  0x0639: 'ARABIC LETTER AIN', 0x063A: 'ARABIC LETTER GHAIN',
  0x0640: 'ARABIC TATWEEL',
  0x0641: 'ARABIC LETTER FEH', 0x0642: 'ARABIC LETTER QAF', 0x0643: 'ARABIC LETTER KAF',
  0x0644: 'ARABIC LETTER LAM', 0x0645: 'ARABIC LETTER MEEM', 0x0646: 'ARABIC LETTER NOON',
  0x0647: 'ARABIC LETTER HEH', 0x0648: 'ARABIC LETTER WAW',
  0x0649: 'ARABIC LETTER ALEF MAKSURA', 0x064A: 'ARABIC LETTER YEH',
  0x064B: 'ARABIC FATHATAN', 0x064C: 'ARABIC DAMMATAN', 0x064D: 'ARABIC KASRATAN',
  0x064E: 'ARABIC FATHA', 0x064F: 'ARABIC DAMMA', 0x0650: 'ARABIC KASRA',
  0x0651: 'ARABIC SHADDA', 0x0652: 'ARABIC SUKUN',
  0x0653: 'ARABIC MADDAH ABOVE', 0x0654: 'ARABIC HAMZA ABOVE', 0x0655: 'ARABIC HAMZA BELOW',
  0x0656: 'ARABIC SUBSCRIPT ALEF', 0x0657: 'ARABIC INVERTED DAMMA',
  0x0658: 'ARABIC MARK NOON GHUNNA', 0x0659: 'ARABIC ZWARAKAY',
  0x065C: 'ARABIC VOWEL SIGN DOT BELOW', 0x065F: 'ARABIC WAVY HAMZA BELOW',
  0x0660: 'ARABIC-INDIC DIGIT ZERO', 0x0661: 'ARABIC-INDIC DIGIT ONE',
  0x0662: 'ARABIC-INDIC DIGIT TWO', 0x0663: 'ARABIC-INDIC DIGIT THREE',
  0x0664: 'ARABIC-INDIC DIGIT FOUR', 0x0665: 'ARABIC-INDIC DIGIT FIVE',
  0x0666: 'ARABIC-INDIC DIGIT SIX', 0x0667: 'ARABIC-INDIC DIGIT SEVEN',
  0x0668: 'ARABIC-INDIC DIGIT EIGHT', 0x0669: 'ARABIC-INDIC DIGIT NINE',
  0x0670: 'ARABIC LETTER SUPERSCRIPT ALEF', 0x0671: 'ARABIC LETTER ALEF WASLA',
  0x06D6: 'SMALL HIGH LIGATURE SAD WITH LAM WITH ALEF MAKSURA (waqf)',
  0x06D7: 'SMALL HIGH LIGATURE QAF WITH LAM WITH ALEF MAKSURA (waqf)',
  0x06D8: 'SMALL HIGH MEEM INITIAL FORM (waqf lazim)',
  0x06D9: 'SMALL HIGH LAM ALEF (waqf)', 0x06DA: 'SMALL HIGH JEEM (waqf)',
  0x06DB: 'SMALL HIGH THREE DOTS (mu‘anaqah)', 0x06DC: 'SMALL HIGH SEEN',
  0x06DD: 'ARABIC END OF AYAH', 0x06DE: 'ARABIC START OF RUB EL HIZB',
  0x06DF: 'SMALL HIGH ROUNDED ZERO (silent letter)',
  0x06E0: 'SMALL HIGH UPRIGHT RECTANGULAR ZERO',
  0x06E1: 'SMALL HIGH DOTLESS HEAD OF KHAH (mushaf sukun)',
  0x06E2: 'SMALL HIGH MEEM ISOLATED FORM', 0x06E3: 'SMALL LOW SEEN',
  0x06E4: 'SMALL HIGH MADDA', 0x06E5: 'SMALL WAW', 0x06E6: 'SMALL YEH',
  0x06E7: 'SMALL HIGH YEH', 0x06E8: 'SMALL HIGH NOON',
  0x06E9: 'ARABIC PLACE OF SAJDAH', 0x06EA: 'EMPTY CENTRE LOW STOP',
  0x06EB: 'EMPTY CENTRE HIGH STOP', 0x06EC: 'ROUNDED HIGH STOP WITH FILLED CENTRE',
  0x06ED: 'SMALL LOW MEEM',
}

// Tatweel is the one character with no business in mushaf text: it is pure
// presentational padding, and its presence is the fingerprint of the old
// `text_uthmani` field. Everything else that might look "modern" is reported
// rather than flagged, because this edition legitimately mixes mark forms
// (U+06E1 for a pronounced sukun, other signs over silent letters) and a
// false alarm here is worse than no alarm.
const SUSPECT = {
  0x0640: 'tatweel padding — presentational, not mushaf orthography',
}

// Reported with counts, never treated as pass/fail. Look at these against a
// mushaf if you want to satisfy yourself about a particular mark.
const REPORT_ONLY = {
  0x0652: 'ARABIC SUKUN (modern round form)',
  0x06E1: 'SMALL HIGH DOTLESS HEAD OF KHAH (mushaf sukun)',
  0x06DF: 'SMALL HIGH ROUNDED ZERO (silent letter)',
  0x0657: 'ARABIC INVERTED DAMMA',
  0x0670: 'SUPERSCRIPT ALEF',
  0x0653: 'MADDAH ABOVE',
}

// Combining marks and presentational padding. Digits U+0660–U+0669 are
// deliberately NOT in this set — they carry the ayah number, which is part of
// the text, not an annotation. (An earlier draft of this file swept them up
// in a range and would have silently deleted every verse number.)
// Written as explicit escapes on purpose: a literal-character range here is
// unreadable and easy to get a codepoint wrong in.
//   0640      tatweel (presentational padding)
//   064B-065F harakat, shadda, maddah, hamza marks, inverted damma
//   0670      superscript alef
//   06D6-06ED Quranic annotation signs (waqf, sajdah, small letters)
const MARKS = /[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/gu

const hex = c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
const nameOf = c => NAMES[c.codePointAt(0)] || '*** NOT IN TABLE — INSPECT THIS ***'

async function api(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  return res.json()
}

// Strip every combining mark so two spellings can be compared on their
// letters alone, and fold the alef variants (wasla ٱ, madda آ, hamza أ إ) onto
// plain alef — otherwise "ٱلله" would not equal "الله" and a correct text
// would look wrong. Used only for verification, never for display.
const ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671]/gu
const skeleton = s => s.replace(MARKS, '').replace(ALEF_VARIANTS, '\u0627')

function dumpVerse(key, text, extra) {
  console.log(`\n${'─'.repeat(72)}`)
  console.log(`  ${key}`)
  console.log(`${'─'.repeat(72)}`)
  console.log(`  ${text}\n`)
  if (extra) { console.log(`  ${extra}\n`) }
  console.log(`  ${'#'.padStart(4)}  ${'char'.padEnd(6)} ${'code'.padEnd(8)} name`)
  let flagged = 0
  ;[...text].forEach((ch, i) => {
    const code = ch.codePointAt(0)
    const flag = SUSPECT[code] ? '  ⚠ ' + SUSPECT[code] : ''
    if (flag) flagged++
    const shown = ch === ' ' ? '␠' : ch
    console.log(`  ${String(i + 1).padStart(4)}  ${shown.padEnd(6)} ${hex(ch).padEnd(8)} ${nameOf(ch)}${flag}`)
  })
  const marks = [...text].filter(c => { MARKS.lastIndex = 0; return MARKS.test(c) }).length
  console.log(`\n  ${[...text].length} characters · ${marks} diacritics/marks · ${flagged} flagged`)
}

// ── Assertion suite ─────────────────────────────────────────────────────
let fail = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + detail}`)
  if (!ok) fail++
}

async function versesOf(id, field = FIELD) {
  const out = []
  let page = 1, total = 1
  do {
    const d = await api(`/verses/by_chapter/${id}?fields=${field}&per_page=50&page=${page}`)
    out.push(...d.verses)
    total = d.pagination.total_pages
    page++
  } while (page <= total)
  return out
}

async function suite() {
  console.log('\n══ QURANIC TEXT AUDIT ══════════════════════════════════════════\n')
  console.log(`  field: ${FIELD}   upstream: ${API}\n`)

  console.log('[1] Al-Fatihah — the bismillah is ayah 1 here, by design')
  const ch1 = (await api('/chapters/1')).chapter
  const s1 = await versesOf(1)
  check('chapter metadata says 7 verses', ch1.verses_count === 7, String(ch1.verses_count))
  check('chapter metadata says bismillah_pre is false', ch1.bismillah_pre === false, String(ch1.bismillah_pre))
  check('exactly 7 verses returned', s1.length === 7, String(s1.length))
  const v1 = s1[0][FIELD]
  check('ayah 1 letters are بسم الله الرحمن الرحيم + marker',
    skeleton(v1).replace(/\s+/g, ' ').trim() === 'بسم الله الرحمن الرحيم ١',
    skeleton(v1))
  check('ayah 1 ends with the marker ١', /١\s*$/u.test(v1), JSON.stringify(v1.slice(-3)))

  console.log('\n[2] Bismillah is NOT inside verse 1 of other surahs')
  for (const n of [2, 3, 18, 36, 55, 67, 112]) {
    const v = (await versesOf(n))[0][FIELD]
    check(`surah ${n} ayah 1 does not begin with the bismillah`,
      !skeleton(v).replace(/\s+/g, ' ').trim().startsWith('بسم الله'), v.slice(0, 50))
  }

  console.log('\n[3] At-Tawbah has no bismillah at all')
  const ch9 = (await api('/chapters/9')).chapter
  check('surah 9 bismillah_pre is false', ch9.bismillah_pre === false, String(ch9.bismillah_pre))

  console.log('\n[4] Verse counts match the mushaf')
  for (const [n, expected] of [[2, 286], [3, 200], [4, 176], [9, 129], [18, 110], [36, 83], [55, 78], [78, 40], [114, 6]]) {
    const v = await versesOf(n)
    check(`surah ${n} has ${expected} verses`, v.length === expected, String(v.length))
  }

  console.log('\n[5] No empty text, no stray markup, every verse ends with its number')
  for (const n of [1, 2, 36, 114]) {
    const vs = await versesOf(n)
    check(`surah ${n}: no empty verse`, vs.every(v => v[FIELD] && v[FIELD].trim()))
    check(`surah ${n}: no HTML or latin digits`, vs.every(v => !/[<>]|[0-9]/.test(v[FIELD])))
    check(`surah ${n}: every verse ends in an Arabic-Indic numeral`,
      vs.every(v => /[٠-٩]\s*$/u.test(v[FIELD])))
  }

  console.log('\n[6] Mushaf orthography, not keyboard Arabic')
  const sample = (await versesOf(2)).slice(0, 30).map(v => v[FIELD]).join(' ')
  // Asserted: tatweel is presentational padding with no place in mushaf text,
  // and its presence would mean the app had slipped back to text_uthmani.
  check('no tatweel padding (U+0640)', !/ـ/u.test(sample))
  // Asserted: these marks must exist, or the text is not the mushaf edition.
  check('mushaf sukun U+06E1 (ۡ) is present', /ۡ/u.test(sample))
  check('maddah above U+0653 (ٓ) is present', /ٓ/u.test(sample))
  check('superscript alef U+0670 (ٰ) is present', /ٰ/u.test(sample))
  check('alef wasla U+0671 (ٱ) is present', /ٱ/u.test(sample))
  check('waqf marks U+06D6–U+06DB are present', /[ۖ-ۛ]/u.test(sample))

  // Reported, not asserted. This edition can legitimately use several sukun-
  // like signs for different purposes, and I would rather show you the counts
  // than fail your build over a mark I have not personally checked against a
  // mushaf. Cross-reference anything here that looks off.
  console.log('\n  Mark inventory over the first 30 verses of Al-Baqarah:')
  for (const [codeStr, label] of Object.entries(REPORT_ONLY)) {
    const code = Number(codeStr)
    const n = [...sample].filter(c => c.codePointAt(0) === code).length
    console.log(`    U+${code.toString(16).toUpperCase().padStart(4, '0')}  ${String(n).padStart(4)}×  ${label}`)
  }
  const unknown = [...new Set([...sample].filter(c => !NAMES[c.codePointAt(0)]))]
  if (unknown.length) {
    console.log('\n  ⚠ Characters not in this script\'s name table — inspect these:')
    for (const c of unknown) console.log(`    ${hex(c)}  ${JSON.stringify(c)}`)
  } else {
    console.log('\n  Every character is a known Arabic letter, mark or numeral.')
  }

  console.log(`\n${fail === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${fail} CHECK(S) FAILED`}\n`)
  console.log('  Anything marked FAIL above means do not ship. Anything marked')
  console.log('  ⚠ in a character dump is worth a second look against a mushaf.\n')
  process.exit(fail ? 1 : 0)
}

// ── Entry ───────────────────────────────────────────────────────────────
const arg = process.argv[2]
const compare = process.argv.includes('--compare')

if (!arg) {
  await suite()
} else if (arg.includes(':')) {
  const [s, a] = arg.split(':').map(Number)
  const field = compare ? `${FIELD},text_uthmani` : FIELD
  const d = await api(`/verses/by_chapter/${s}?fields=${field}&per_page=50&page=${Math.ceil(a / 50)}`)
  const v = d.verses.find(x => x.verse_number === a)
  if (!v) { console.error(`No such verse ${arg}`); process.exit(1) }
  dumpVerse(`${arg}   (${FIELD})`, v[FIELD])
  if (compare) dumpVerse(`${arg}   (text_uthmani — the OLD field, for contrast)`, v.text_uthmani)
} else {
  const n = Number(arg)
  const field = compare ? `${FIELD},text_uthmani` : FIELD
  const vs = await versesOf(n, field)
  for (const v of vs) {
    dumpVerse(`${v.verse_key}   (${FIELD})`, v[FIELD])
    if (compare) dumpVerse(`${v.verse_key}   (text_uthmani — the OLD field)`, v.text_uthmani)
  }
}
GE_EOF_9328AB98

echo "  writing scripts/fetch-quran-font.sh"
save 'scripts/fetch-quran-font.sh'
cat > 'scripts/fetch-quran-font.sh' <<'GE_EOF_05BF8102'
#!/usr/bin/env bash
# Downloads the official King Fahd Complex Uthmani Hafs font into
# public/fonts/ as the offline fallback for the Quran reader.
#
#   bash scripts/fetch-quran-font.sh
#
# The app loads this font from the Quran Foundation CDN first (so you get
# their corrections automatically); this local copy is what keeps the mushaf
# rendering when the reader is opened offline as an installed PWA.
#
# Re-run it whenever the Complex publishes a new version.
set -euo pipefail

CDN="https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs"
FILE="UthmanicHafs1Ver18.woff2"
DEST="public/fonts"

if [ ! -d public ]; then
  echo "✗ Run this from the root of the green-emblem project."
  exit 1
fi

mkdir -p "$DEST"
echo "→ Downloading $FILE from the Quran Foundation CDN"
curl -fSL --retry 3 -o "$DEST/$FILE.tmp" "$CDN/$FILE"

# A truncated or HTML error page must never be installed as the Quran font.
BYTES=$(wc -c < "$DEST/$FILE.tmp")
if [ "$BYTES" -lt 50000 ]; then
  rm -f "$DEST/$FILE.tmp"
  echo "✗ Downloaded file is only $BYTES bytes — that is not the font."
  echo "  Nothing was installed. Check your connection and try again."
  exit 1
fi
# woff2 files begin with the ASCII magic "wOF2".
MAGIC=$(head -c 4 "$DEST/$FILE.tmp")
if [ "$MAGIC" != "wOF2" ]; then
  rm -f "$DEST/$FILE.tmp"
  echo "✗ Downloaded file is not a woff2 font (magic was '$MAGIC')."
  echo "  Nothing was installed."
  exit 1
fi

mv "$DEST/$FILE.tmp" "$DEST/$FILE"
echo "✓ Installed $DEST/$FILE ($BYTES bytes)"
echo
echo "  Commit it so Vercel serves it:"
echo "    git add $DEST/$FILE && git commit -m 'add offline Uthmani Hafs font'"
echo
echo "  Font terms: http://dm.qurancomplex.gov.sa/copyright-2/"
GE_EOF_05BF8102

echo "  writing mock-quran-api.mjs"
save 'mock-quran-api.mjs'
cat > 'mock-quran-api.mjs' <<'GE_EOF_62B00A12'
// Fixture upstream for verifying the Quran reader end to end.
// Every Arabic string is built from explicit codepoints so the fixture cannot
// be corrupted by copy-paste, and so the expected output is provable.
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT || 4310)

const cp = (...c) => String.fromCodePoint(...c)

// بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ  — QPC Hafs spelling (U+06E1 sukun, no tatweel)
const W_BISM   = cp(0x0628,0x0650,0x0633,0x06E1,0x0645,0x0650)
const W_ALLAH  = cp(0x0671,0x0644,0x0644,0x0651,0x064E,0x0647,0x0650)
const W_RAHMAN = cp(0x0671,0x0644,0x0631,0x0651,0x064E,0x062D,0x06E1,0x0645,0x064E,0x0670,0x0646,0x0650)
const W_RAHIM  = cp(0x0671,0x0644,0x0631,0x0651,0x064E,0x062D,0x0650,0x064A,0x0645,0x0650)
const BISMILLAH = [W_BISM, W_ALLAH, W_RAHMAN, W_RAHIM].join(' ')

const ARABIC_DIGITS = n => String(n).replace(/\d/g, d => cp(0x0660 + Number(d)))
// الٓمٓ — Al-Baqarah 1, with maddah above (U+0653)
const ALIF_LAM_MEEM = cp(0x0627,0x0644,0x0653,0x0645,0x0653)

const verse = (key, n, text) => ({
  verse_key: key, verse_number: n,
  text_qpc_hafs: `${text} ${ARABIC_DIGITS(n)}`,
  translations: [{ text: `Translation of ${key}` }],
})

// The app asserts exactly 114 chapters (a real guard against a truncated
// upstream), so the fixture must supply all of them. Only 1, 2 and 9 carry
// verse fixtures; the rest are structural filler.
const SPECIAL = {
  1: { name: 'Al-Fatihah', arabic: cp(0x0627,0x0644,0x0641,0x0627,0x062A,0x062D,0x0629), count: 7, bismillah: false },
  2: { name: 'Al-Baqarah', arabic: cp(0x0627,0x0644,0x0628,0x0642,0x0631,0x0629),        count: 3, bismillah: true  },
  9: { name: 'At-Tawbah',  arabic: cp(0x0627,0x0644,0x062A,0x0648,0x0628,0x0629),        count: 2, bismillah: false },
}
const CHAPTERS = Array.from({ length: 114 }, (_, i) => {
  const id = i + 1
  const s = SPECIAL[id]
  return {
    id,
    name_simple: s ? s.name : `Surah ${id}`,
    name_arabic: s ? s.arabic : cp(0x0633,0x0648,0x0631,0x0629),
    translated_name: { name: s ? s.name : `Chapter ${id}` },
    verses_count: s ? s.count : 1,
    bismillah_pre: s ? s.bismillah : true,
    revelation_place: id === 1 ? 'makkah' : 'madinah',
  }
})

const VERSES = {
  1: [
    verse('1:1', 1, BISMILLAH),
    verse('1:2', 2, cp(0x0671,0x0644,0x06E1,0x062D,0x0645,0x06E1,0x062F,0x064F)),
    verse('1:3', 3, W_RAHMAN + ' ' + W_RAHIM),
    verse('1:4', 4, cp(0x0645,0x064E,0x0670,0x0644,0x0650,0x0643,0x0650)),
    verse('1:5', 5, cp(0x0625,0x0650,0x064A,0x0651,0x064E,0x0627,0x0643,0x064E)),
    verse('1:6', 6, cp(0x0671,0x0647,0x06E1,0x062F,0x0650,0x0646,0x064E,0x0627)),
    verse('1:7', 7, cp(0x0635,0x0650,0x0631,0x064E,0x0670,0x0637,0x064E)),
  ],
  2: [
    verse('2:1', 1, ALIF_LAM_MEEM),
    verse('2:2', 2, cp(0x0630,0x064E,0x0670,0x0644,0x0650,0x0643,0x064E) + cp(0x06DB)),
    verse('2:3', 3, cp(0x0671,0x0644,0x0651,0x064E,0x0630,0x0650,0x064A,0x0646,0x064E)),
  ],
  9: [
    verse('9:1', 1, cp(0x0628,0x064E,0x0631,0x064E,0x0627,0x0621,0x064C)),
    verse('9:2', 2, cp(0x0641,0x064E,0x0633,0x0650,0x064A,0x062D,0x064F,0x0648,0x0627)),
  ],
}

const json = (res, body) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname

  if (p === '/api/v4/chapters') return json(res, { chapters: CHAPTERS })

  const byChapter = p.match(/^\/api\/v4\/verses\/by_chapter\/(\d+)$/)
  if (byChapter) {
    const id = Number(byChapter[1])
    const all = VERSES[id] || []
    const wantWords = url.searchParams.get('words') === 'true'
    const perPage = Number(url.searchParams.get('per_page') || 50)
    const page = Number(url.searchParams.get('page') || 1)
    const slice = all.slice((page - 1) * perPage, page * perPage)

    // The bismillah lookup asks for 1:1 with words=true. Mirror the real
    // shape: each word separately, with the ayah marker as char_type 'end'.
    const verses = slice.map(v => {
      if (!wantWords) return v
      const words = [W_BISM, W_ALLAH, W_RAHMAN, W_RAHIM]
        .map(w => ({ char_type_name: 'word', text_qpc_hafs: w }))
      words.push({ char_type_name: 'end', text_qpc_hafs: ARABIC_DIGITS(v.verse_number) })
      return { ...v, words }
    })

    return json(res, {
      verses,
      pagination: { total_pages: Math.max(1, Math.ceil(all.length / perPage)), current_page: page },
    })
  }

  if (p === '/api/v4/resources/tafsirs') {
    return json(res, { tafsirs: [{ id: 169, name: 'Tafsir Ibn Kathir', language_name: 'english' }] })
  }
  if (p.startsWith('/api/v4/resources/translations')) {
    return json(res, { translations: [{ id: 131, name: 'Dr. Mustafa Khattab', language_name: 'english' }] })
  }
  if (p.startsWith('/api/v4/tafsirs/')) {
    return json(res, { tafsir: { text: '<p>Ibn Kathir fixture.</p>', resource_name: 'Tafsir Ibn Kathir' } })
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end('{"error":"not found in fixture"}')
}).listen(PORT, () => console.log('fixture upstream on http://localhost:' + PORT))
GE_EOF_62B00A12

echo "  writing verify-quran-render.mjs"
save 'verify-quran-render.mjs'
cat > 'verify-quran-render.mjs' <<'GE_EOF_78E6E142'
import { chromium } from 'playwright'

// Verifies the rendered Quran reader against a fixture upstream whose Arabic
// is built from explicit codepoints. Checks the two things that can be wrong
// structurally — where the bismillah goes, and whether the ayah number is
// doubled — plus that the mushaf font is actually applied.

const BASE = (process.argv[2] || 'http://localhost:3150').replace(/\/$/, '')
const cp = (...c) => String.fromCodePoint(...c)
const BISM_SKELETON = cp(0x0628, 0x0633, 0x0645) + ' ' + cp(0x0627, 0x0644, 0x0644, 0x0647)
const MARKS = /[ـً-ٰٟۖ-ۭ]/gu
const skeleton = s => s.replace(MARKS, '').replace(/[آأإٱ]/gu, cp(0x0627))
const flat = s => skeleton(s).replace(/\s+/g, ' ').trim()

let fail = 0
const check = (n, ok, x = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  → ' + x}`)
  if (!ok) fail++
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage()
p.on('pageerror', e => console.log('  PAGEERROR:', String(e).slice(0, 160)))

const openSurah = async n => {
  await p.goto(`${BASE}/prayer?tab=quran`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  // Surah buttons render as e.g. "1Al-Fatihahالفاتحة" — the number runs
  // straight into the name, so anchor on it and forbid a following digit
  // (otherwise surah 1 also matches 11, 12, …).
  const clicked = await p.evaluate(num => {
    const re = new RegExp('^\\s*' + num + '(?![0-9])')
    const target = [...document.querySelectorAll('button')]
      .find(b => re.test((b.textContent || '').trim()))
    if (target) { target.click(); return (target.textContent || '').slice(0, 30) }
    return null
  }, n)
  await p.waitForTimeout(2500)
  if (!clicked) throw new Error(`could not find the surah ${n} button`)
  return clicked
}

// Arabic verse paragraphs are the rtl <p> elements.
const arabicLines = () => p.evaluate(() =>
  [...document.querySelectorAll('p[dir="rtl"][lang="ar"]')].map(el => el.textContent || ''))

console.log('\n[1] Surah 1 — the bismillah IS ayah 1, with no separate header')
{
  await openSurah(1)
  const lines = await arabicLines()
  check('seven verse lines rendered', lines.length === 7, String(lines.length))
  check('ayah 1 is the bismillah', flat(lines[0] || '').startsWith(BISM_SKELETON), flat(lines[0] || ''))
  check('ayah 1 ends with the marker ١', /١\s*$/u.test((lines[0] || '').trim()),
    JSON.stringify((lines[0] || '').trim().slice(-3)))
  // The old code appended its own circled numeral; that would double it.
  const ones = [...(lines[0] || '')].filter(c => c.codePointAt(0) === 0x0661).length
  check('the ayah number appears exactly once (not doubled)', ones === 1, `found ${ones}`)
  const headerCount = await p.evaluate(() => document.body.innerText.split('\n')
    .filter(l => /^\s*بِسۡمِ|^\s*بسم/.test(l)).length)
  check('no separate bismillah header element above the verses', headerCount <= 1, String(headerCount))
}

console.log('\n[2] Surah 2 — bismillah is a separate header, NOT inside ayah 1')
{
  await openSurah(2)
  const lines = await arabicLines()
  check('three verse lines rendered', lines.length === 3, String(lines.length))
  check('ayah 1 does NOT start with the bismillah',
    !flat(lines[0] || '').startsWith(BISM_SKELETON), flat(lines[0] || ''))
  check('ayah 1 is alif-lam-meem', flat(lines[0] || '').startsWith(cp(0x0627, 0x0644, 0x0645)),
    flat(lines[0] || ''))
  const pageText = await p.evaluate(() => document.body.innerText)
  check('the bismillah appears somewhere as a header', flat(pageText).includes(BISM_SKELETON))
  // The header must carry no ayah number — it is not a verse.
  const header = await p.evaluate(() => {
    const el = [...document.querySelectorAll('div,p')]
      .find(e => e.children.length === 0 && /بِسۡمِ/.test(e.textContent || ''))
    return el ? el.textContent : null
  })
  check('header text exists', !!header, String(header))
  if (header) check('header carries NO ayah number', !/[٠-٩]/u.test(header), JSON.stringify(header))
}

console.log('\n[3] Surah 9 — no bismillah anywhere')
{
  await openSurah(9)
  const pageText = await p.evaluate(() => document.body.innerText)
  const lines = await arabicLines()
  check('two verse lines rendered', lines.length === 2, String(lines.length))
  check('ayah 1 does not start with the bismillah',
    !flat(lines[0] || '').startsWith(BISM_SKELETON), flat(lines[0] || ''))
  check('no bismillah header on At-Tawbah', !flat(pageText).includes(BISM_SKELETON))
}

console.log('\n[4] The mushaf font is wired up')
// Asserted against the CSS itself, not getComputedStyle: this build stubs
// next/font (the sandbox cannot reach Google Fonts), which leaves
// var(--font-amiri-quran) undefined and makes the whole computed font-family
// fall back. That is an artefact of the test environment, not the app, so we
// check the declarations that actually ship.
{
  await openSurah(1)
  const css = await p.evaluate(() => {
    const el = document.querySelector('p[dir="rtl"][lang="ar"]')
    const faces = [...document.styleSheets]
      .flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
      .filter(r => r.constructor.name === 'CSSFontFaceRule')
      .map(r => r.cssText)
    return {
      inline: el?.getAttribute('style') || '',
      // The DECLARED value, not the computed one. Computed would be empty
      // here because the stubbed next/font leaves var(--font-amiri-quran)
      // undefined, which makes the whole custom property invalid at
      // computed-value time. The declaration is what ships.
      stack: [...document.styleSheets]
        .flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
        .filter(r => r.style && r.selectorText && /(^|,)\s*:root\s*($|,)/.test(r.selectorText))
        .map(r => r.style.getPropertyValue('--font-uthmani').trim())
        .find(Boolean) || '',
      faces,
    }
  })
  check('verse text asks for the Uthmani stack', /var\(--font-uthmani\)/.test(css.inline), css.inline.slice(0, 80))
  check('the stack names the KFGQPC face first', /^\s*["']?KFGQPC Uthmanic Script HAFS["']?\s*,/.test(css.stack), css.stack)
  check('Amiri Quran remains in the stack as last resort', /amiri/i.test(css.stack), css.stack)
  const face = css.faces.find(f => /KFGQPC Uthmanic Script HAFS/.test(f)) || ''
  check('@font-face exists for the KFGQPC face', !!face, String(css.faces.length) + ' font-face rules')
  check('it loads from the official Quran Foundation CDN',
    /verses\.quran\.foundation\/fonts\/quran\/hafs\/uthmanic_hafs\/UthmanicHafs1Ver18\.woff2/.test(face), face.slice(0, 160))
  check('it has a self-hosted offline fallback', /\/fonts\/UthmanicHafs1Ver18\.woff2/.test(face), face.slice(0, 200))
}

await b.close()
console.log(fail === 0 ? '\nALL CHECKS PASSED\n' : `\n${fail} CHECK(S) FAILED\n`)
process.exit(fail ? 1 : 0)
GE_EOF_78E6E142


echo
echo "→ Verifying"
FAIL=0
ck() {
  if [ ! -f "$1" ]; then echo "  ✗ MISSING  $1"; FAIL=1; return; fi
  if ! grep -qF -- "$2" "$1"; then echo "  ✗ TRUNCATED $1"; FAIL=1; return; fi
  echo "  ✓ $1"
}
ck 'lib/quran-api.ts' 'text_qpc_hafs'
ck 'lib/quran.ts' 'deliberately gone'
ck 'components/QuranReader.tsx' 'end-of-ayah marker'
ck 'app/globals.css' 'UthmanicHafs1Ver18'
ck 'public/sw.js' 'isQuranFont'
ck 'scripts/verify-quran.mjs' 'startsWithBismillah'
ck 'scripts/audit-quran-text.mjs' 'SMALL HIGH DOTLESS HEAD OF KHAH'
ck 'scripts/fetch-quran-font.sh' 'wOF2'
ck 'mock-quran-api.mjs' '0x06E1'
ck 'verify-quran-render.mjs' 'not doubled'

# The old field must be gone from the render path entirely.
if grep -q "text_uthmani" lib/quran-api.ts | head -1; then :; fi
if grep -n "text_uthmani" lib/quran-api.ts | grep -v "^.*//" | grep -q "fields=text_uthmani"; then
  echo "  ✗ lib/quran-api.ts still FETCHES text_uthmani"; FAIL=1
else
  echo "  ✓ text_uthmani is no longer fetched (only mentioned in comments)"
fi

echo
if [ "$FAIL" -ne 0 ]; then
  echo "✗ Did not apply cleanly. Do not commit. Re-run the script."
  exit 1
fi

echo "════════════════════════════════════════════════════════════════"
echo " APPLIED"
echo "════════════════════════════════════════════════════════════════"
echo
echo " 1. Download the offline font fallback (optional but recommended):"
echo "      bash scripts/fetch-quran-font.sh"
echo
echo " 2. Deploy:"
echo "      git add -A"
echo "      git commit -m 'Quran: QPC Hafs mushaf text + official Uthmani font'"
echo "      git push"
echo
echo " 3. AUDIT THE TEXT YOURSELF — this is the point of the change:"
echo "      node scripts/audit-quran-text.mjs              # assertion suite"
echo "      node scripts/audit-quran-text.mjs 1            # every char of Al-Fatihah"
echo "      node scripts/audit-quran-text.mjs 1 --compare  # new vs old, side by side"
echo "      node scripts/audit-quran-text.mjs 2:255        # Ayat al-Kursi"
echo
echo "    It prints every codepoint with its Unicode name so you can check it"
echo "    against your mushaf mark by mark."
echo
echo " 4. After deploying, verify the live site:"
echo "      node scripts/verify-quran.mjs https://green-emblem.com"
echo

