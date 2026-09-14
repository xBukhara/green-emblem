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

// "بسم الله" prefix in Uthmani script, normalised of diacritics for matching
const BISMILLAH_START = /^\s*بِسْمِ\s*ٱ?للَّه/u

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
    check(`surah ${n} verse 1 is clean`, !BISMILLAH_START.test(first), first.slice(0, 60))
  }

  console.log('\n[2] Bismillah is served separately where it belongs')
  const s2 = await surah(2)
  check('surah 2 flags a bismillah header', s2.showBismillah === true)
  check('surah 2 header text is the bismillah', BISMILLAH_START.test(s2.bismillah), s2.bismillah)

  const s1 = await surah(1)
  check('Al-Fatihah has NO separate header (it is verse 1)', s1.showBismillah === false)
  check('Al-Fatihah verse 1 IS the bismillah', BISMILLAH_START.test(s1.verses[0].uthmani), s1.verses[0].uthmani)

  const s9 = await surah(9)
  check('At-Tawbah has no bismillah at all', s9.showBismillah === false)
  check('At-Tawbah verse 1 is clean', !BISMILLAH_START.test(s9.verses[0].uthmani), s9.verses[0].uthmani)

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
