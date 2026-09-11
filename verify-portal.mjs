import { chromium } from 'playwright'

const PORT = process.argv[2] || '3150'
const MAIN = `http://localhost:${PORT}`
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0
const check = (n, ok, x = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + x}`)
  if (!ok) fail++
}

// Host headers can't be overridden in Playwright, so the portal is reached
// through a real *.localhost subdomain (RFC 6761 — resolves to loopback).
const PORTAL = `http://masjid.localhost:${PORT}`
const portalCtx = await b.newContext()
const mainCtx = await b.newContext()

console.log('\n[1] Hostname routing selects the right app')
{
  const p = await portalCtx.newPage()
  const res = await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'domcontentloaded' })
  check('portal host serves the portal sign-in', res.status() === 200, 'HTTP ' + res.status())
  const txt = (await p.textContent('body')) || ''
  check('shows MASJID PORTAL branding', /MASJID PORTAL/i.test(txt), txt.slice(0, 100))
  check('does not show the consumer nav', !/Baab As-Sadaqah|GreenWorld/i.test(txt))
  await p.close()

  const q = await mainCtx.newPage()
  await q.goto(`${MAIN}/`, { waitUntil: 'domcontentloaded' })
  const mainTxt = (await q.textContent('body')) || ''
  check('main host still serves the consumer app', /Green Emblem/i.test(mainTxt))
  await q.close()
}

console.log('\n[2] Portal pages are gated')
{
  for (const path of ['/', '/posts', '/posts/new', '/profile']) {
    const p = await portalCtx.newPage()
    await p.goto(`${PORTAL}${path}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(2500)
    const url = p.url()
    check(`${path} redirects an anonymous visitor to sign-in`, url.includes('/sign-in') || url.includes('/portal/sign-in'), url)
    await p.close()
  }
}

console.log('\n[3] Portal APIs reject non-members')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'domcontentloaded' })
  for (const [path, method] of [
    ['/api/portal/posts', 'GET'],
    ['/api/portal/posts', 'POST'],
    ['/api/portal/invite', 'POST'],
  ]) {
    const status = await p.evaluate(async ([u, m]) => {
      const r = await fetch(u, {
        method: m,
        headers: { 'Content-Type': 'application/json' },
        body: m === 'GET' ? undefined : '{}',
      })
      return r.status
    }, [`${PORTAL}${path}`, method])
    check(`${method} ${path} rejects anonymous`, status === 403 || status === 401, 'HTTP ' + status)
  }
  await p.close()
}

console.log('\n[4] Invite links validate before asking for a password')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/invite/not-a-real-token`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2000)
  const txt = (await p.textContent('body')) || ''
  // Any of the four honest outcomes is fine; what must never happen is
  // spinning on LOADING… or silently offering a password form.
  check(
    'bad token shows an explanation, not a password form',
    /isn.t valid|not valid|expired|already been used|couldn.t check/i.test(txt),
    txt.slice(0, 160)
  )
  check('does not hang on a loading state', !/LOADING…/.test(txt), txt.slice(0, 80))
  const hasPw = await p.evaluate(() => !!document.querySelector('input[type="password"]'))
  check('no password field is offered for an invalid invite', !hasPw)
  await p.close()
}

console.log('\n[5] RSVP endpoint: "Going" only, and auth-gated')
{
  const p = await mainCtx.newPage()
  await p.goto(`${MAIN}/`, { waitUntil: 'domcontentloaded' })
  const fake = '00000000-0000-0000-0000-000000000000'
  const results = await p.evaluate(async ([base, id]) => {
    const out = {}
    const g = await fetch(`${base}/api/posts/${id}/rsvp`)
    out.getStatus = g.status
    out.getBody = await g.text()
    const post = await fetch(`${base}/api/posts/${id}/rsvp`, { method: 'POST' })
    out.postStatus = post.status
    const del = await fetch(`${base}/api/posts/${id}/rsvp`, { method: 'DELETE' })
    out.delStatus = del.status
    // There must be no endpoint that records non-attendance
    const notGoing = await fetch(`${base}/api/posts/${id}/rsvp`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ going: false }),
    })
    out.putStatus = notGoing.status
    return out
  }, [MAIN, fake])

  check('anonymous GET returns a count', results.getStatus === 200, 'HTTP ' + results.getStatus)
  check('GET response has no "not going" field', !/not_?going|declin|skip/i.test(results.getBody), results.getBody?.slice(0, 100))
  check('anonymous POST is rejected', results.postStatus === 401, 'HTTP ' + results.postStatus)
  check('anonymous DELETE is rejected', results.delStatus === 401, 'HTTP ' + results.delStatus)
  check('no PUT handler exists (no way to record absence)', results.putStatus === 405, 'HTTP ' + results.putStatus)
  await p.close()
}

console.log('\n[6] Portal is kept out of search engines')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'domcontentloaded' })
  const robots = await p.evaluate(() =>
    document.querySelector('meta[name="robots"]')?.getAttribute('content') || '')
  check('portal sets noindex', /noindex/i.test(robots), robots || '(none)')
  await p.close()
}

console.log('\n[7] Portal layout has no consumer chrome')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const chrome = await p.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Primary"]')
    return {
      bottomNav: !!bar,
      // Belt and braces: even in the frame before hydration unmounts it,
      // the portal layout's stylesheet must keep it off the screen.
      bottomNavVisible: !!bar && getComputedStyle(bar).display !== 'none',
      consumerNav: !!document.querySelector('nav[aria-label="Main navigation"]'),
      bodyPadding: getComputedStyle(document.body).paddingBottom,
    }
  })
  check('no consumer bottom tab bar in the DOM', !chrome.bottomNav)
  check('bottom tab bar is not visible even pre-hydration', !chrome.bottomNavVisible)
  check('no consumer top nav', !chrome.consumerNav)
  check('no tab-bar padding reserved on body', chrome.bodyPadding === '0px', chrome.bodyPadding)
  await p.close()

  // The failure mode of the fix above is removing the tab bar everywhere.
  // Prove the consumer app still has it, on a phone viewport.
  const q = await mainCtx.newPage()
  await q.setViewportSize({ width: 390, height: 844 })
  await q.goto(`${MAIN}/`, { waitUntil: 'networkidle' })
  await q.waitForTimeout(1200)
  const consumer = await q.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Primary"]')
    return { present: !!bar, visible: !!bar && getComputedStyle(bar).display !== 'none' }
  })
  check('consumer app STILL has its bottom tab bar on mobile', consumer.present && consumer.visible,
    JSON.stringify(consumer))
  await q.close()
}

await b.close()
console.log(fail === 0 ? '\nALL CHECKS PASSED\n' : `\n${fail} CHECK(S) FAILED\n`)
process.exit(fail ? 1 : 0)
