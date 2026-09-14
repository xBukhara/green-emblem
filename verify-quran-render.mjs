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
