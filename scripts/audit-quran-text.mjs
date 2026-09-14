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
