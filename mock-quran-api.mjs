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
