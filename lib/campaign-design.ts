// ── Campaign Design System ─────────────────────────────────────────────────
// Shared between the design studio (builder), the live give page, and the
// admin template manager. A campaign's `theme` JSON stores ids from here
// plus any custom color overrides.

export type FontPair = {
  id: string
  label: string
  heading: string   // CSS font-family for headings
  body: string      // CSS font-family for body
  google: string    // Google Fonts families query (for <link>)
}

export const FONT_PAIRS: FontPair[] = [
  { id: 'cinzel',    label: 'Cinzel · Cormorant',    heading: "'Cinzel', serif",           body: "'Cormorant Garamond', serif", google: 'Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400' },
  { id: 'playfair',  label: 'Playfair · Inter',      heading: "'Playfair Display', serif", body: "'Inter', sans-serif",         google: 'Playfair+Display:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500' },
  { id: 'marcellus', label: 'Marcellus · Karla',     heading: "'Marcellus', serif",        body: "'Karla', sans-serif",         google: 'Marcellus&family=Karla:wght@400;500' },
  { id: 'amiri',     label: 'Amiri · Source Sans',   heading: "'Amiri', serif",            body: "'Source Sans 3', sans-serif", google: 'Amiri:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;500' },
  { id: 'fraunces',  label: 'Fraunces · Nunito',     heading: "'Fraunces', serif",         body: "'Nunito Sans', sans-serif",   google: 'Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito+Sans:wght@400;600' },
]

export function fontPair(id?: string | null): FontPair {
  return FONT_PAIRS.find(f => f.id === id) || FONT_PAIRS[0]
}

export function googleFontsHref(id?: string | null): string {
  const f = fontPair(id)
  return `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`
}

// ── Patterns (base background layer) ───────────────────────────────────────
export const PATTERNS = [
  { id: 'star8',     label: '8-pointed star' },
  { id: 'arabesque', label: 'Arabesque' },
  { id: 'geometric', label: 'Geometric tile' },
  { id: 'lattice',   label: 'Mashrabiya lattice' },
  { id: 'none',      label: 'Clean' },
] as const

// ── Overlays (decorative layer on top of pattern) ──────────────────────────
export const OVERLAYS = [
  { id: 'none',    label: 'None' },
  { id: 'frame',   label: 'Gold frame' },
  { id: 'corners', label: 'Corner ornaments' },
  { id: 'arch',    label: 'Mihrab arch glow' },
  { id: 'crescent',label: 'Crescent watermark' },
] as const

// ── Built-in colorway templates ────────────────────────────────────────────
export type CampaignTemplate = {
  id: string
  name: string
  bg: string
  accent: string
  text: string
  font_pair: string
  pattern: string
  overlay: string
  pattern_opacity: number
  is_builtin?: boolean
}

export const BUILTIN_TEMPLATES: CampaignTemplate[] = [
  { id: 'forest_gold', name: 'Forest & Gold',       bg: '#0f1f0f', accent: '#d4af6e', text: '#f5f0e6', font_pair: 'cinzel',    pattern: 'star8',     overlay: 'frame',    pattern_opacity: 0.07, is_builtin: true },
  { id: 'navy_gold',   name: 'Midnight & Gold',     bg: '#0a1628', accent: '#d4af6e', text: '#ffffff', font_pair: 'playfair',  pattern: 'lattice',   overlay: 'arch',     pattern_opacity: 0.06, is_builtin: true },
  { id: 'burgundy',    name: 'Burgundy & Cream',    bg: '#1a0508', accent: '#c9956c', text: '#f5f0e6', font_pair: 'fraunces',  pattern: 'arabesque', overlay: 'corners',  pattern_opacity: 0.08, is_builtin: true },
  { id: 'violet',      name: 'Violet & Silver',     bg: '#120a1e', accent: '#9b8ec4', text: '#ffffff', font_pair: 'marcellus', pattern: 'geometric', overlay: 'crescent', pattern_opacity: 0.07, is_builtin: true },
  { id: 'terracotta',  name: 'Terracotta & Sage',   bg: '#1a0f08', accent: '#8fad8a', text: '#f5f0e6', font_pair: 'amiri',     pattern: 'arabesque', overlay: 'frame',    pattern_opacity: 0.08, is_builtin: true },
  { id: 'charcoal',    name: 'Charcoal & Rose',     bg: '#161616', accent: '#c4906a', text: '#ffffff', font_pair: 'playfair',  pattern: 'geometric', overlay: 'none',     pattern_opacity: 0.06, is_builtin: true },
  { id: 'emerald',     name: 'Emerald & Ivory',     bg: '#06251c', accent: '#e8ddc0', text: '#ffffff', font_pair: 'marcellus', pattern: 'star8',     overlay: 'arch',     pattern_opacity: 0.06, is_builtin: true },
  { id: 'blush',       name: 'Blush & Bronze',      bg: '#241318', accent: '#d8a48f', text: '#fdf6f0', font_pair: 'fraunces',  pattern: 'lattice',   overlay: 'corners',  pattern_opacity: 0.07, is_builtin: true },
]

export const VERSES = [
  { id: 'tirmidhi_shade', label: 'Shade of generosity', text: 'The generous person is close to Allah, close to Paradise, close to the people.' },
  { id: 'quran_2_272',    label: 'Quran 2:272',          text: 'Whatever good you give is for yourselves, and whatever you spend is fully repaid to you.' },
  { id: 'tirmidhi_fire',  label: 'Shield from fire',     text: 'Save yourself from the fire, even with half a date given in charity.' },
  { id: 'custom',         label: 'Write my own',         text: '' },
]

// ── Printable QR card (server-side, SVG string) ─────────────────────────────
// Used by /api/campaigns/[slug]/qr-card. A plain QR is easy to lose in a
// stack of table cards — this wraps the code in the same colorway, pattern
// and font pairing the organizer picked in the studio, so what they print
// actually matches their event. The QR itself stays on a near-white plate
// for scan reliability regardless of the campaign's background color.

const CARD_FONT_STACKS: Record<string, { heading: string; body: string }> = {
  cinzel:    { heading: "'Cinzel', Georgia, 'Palatino Linotype', serif", body: "Georgia, 'Times New Roman', serif" },
  playfair:  { heading: "'Playfair Display', Georgia, serif",            body: "Verdana, Arial, sans-serif" },
  marcellus: { heading: "'Marcellus', Georgia, serif",                   body: "'Trebuchet MS', Arial, sans-serif" },
  amiri:     { heading: "'Amiri', 'Times New Roman', serif",             body: "Verdana, Arial, sans-serif" },
  fraunces:  { heading: "'Fraunces', Georgia, serif",                    body: "'Segoe UI', Arial, sans-serif" },
}

function cardPatternDefs(id: string, accent: string, opacity: number): string {
  if (id === 'none') return ''
  const o = Math.min(opacity + 0.05, 0.22)
  if (id === 'star8') return `
    <pattern id="cardpat" width="80" height="80" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="${accent}" stroke-width="1.4" opacity="${o}">
        <rect x="20" y="20" width="40" height="40" rx="2"/>
        <rect x="20" y="20" width="40" height="40" rx="2" transform="rotate(45 40 40)"/>
      </g>
    </pattern>`
  if (id === 'arabesque') return `
    <pattern id="cardpat" width="60" height="60" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="${accent}" stroke-width="1.2" opacity="${o}">
        <circle cx="30" cy="30" r="20"/><circle cx="30" cy="30" r="10"/>
        <line x1="10" y1="30" x2="50" y2="30"/><line x1="30" y1="10" x2="30" y2="50"/>
      </g>
    </pattern>`
  if (id === 'lattice') return `
    <pattern id="cardpat" width="44" height="44" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="${accent}" stroke-width="1.1" opacity="${o}">
        <path d="M22 0 L44 22 L22 44 L0 22 Z"/><circle cx="22" cy="22" r="4"/>
      </g>
    </pattern>`
  return `
    <pattern id="cardpat" width="50" height="50" patternUnits="userSpaceOnUse">
      <polygon points="25,5 45,15 45,35 25,45 5,35 5,15" fill="none" stroke="${accent}" stroke-width="1.2" opacity="${o}"/>
    </pattern>`
}

export function buildQrCardSvg(opts: {
  bg: string
  accent: string
  text: string
  fontPair?: string | null
  pattern: string
  patternOpacity: number
  honoreeNames: string
  eventType: string
  eventDate?: string | null
  qrInnerSvg: string   // the <path> markup from QRCode.toString({type:'svg'})
  qrViewBox: string    // e.g. "0 0 33 33"
}): string {
  const { bg, accent, text, pattern, patternOpacity, honoreeNames, eventType, eventDate, qrInnerSvg, qrViewBox } = opts
  const fonts = CARD_FONT_STACKS[opts.fontPair || 'cinzel'] || CARD_FONT_STACKS.cinzel

  const W = 1000, H = 1300
  const cardMargin = 44
  const qrBoxSize = 460
  const qrBoxX = (W - qrBoxSize) / 2
  const qrBoxY = 430
  const qrPad = 34

  const patternDefs = cardPatternDefs(pattern, accent, patternOpacity)
  const patternFill = pattern === 'none' ? '' : `<rect x="${cardMargin}" y="${cardMargin}" width="${W - cardMargin * 2}" height="${H - cardMargin * 2}" fill="url(#cardpat)"/>`

  const eventLine = [eventType, eventDate].filter(Boolean).join('  ·  ')

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${patternDefs}
    <radialGradient id="cardglow" cx="50%" cy="18%" r="60%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect width="${W}" height="${H}" fill="url(#cardglow)"/>
  ${patternFill}

  <!-- outer frame -->
  <rect x="${cardMargin}" y="${cardMargin}" width="${W - cardMargin * 2}" height="${H - cardMargin * 2}" rx="26"
        fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.85"/>
  <rect x="${cardMargin + 14}" y="${cardMargin + 14}" width="${W - (cardMargin + 14) * 2}" height="${H - (cardMargin + 14) * 2}" rx="18"
        fill="none" stroke="${accent}" stroke-width="1" opacity="0.35"/>

  <!-- header -->
  <text x="${W / 2}" y="150" text-anchor="middle" font-family="${fonts.body}" font-size="30" fill="${accent}" opacity="0.85">&#1576;&#1614;&#1575;&#1576;&#1615; &#1575;&#1604;&#1589;&#1614;&#1617;&#1583;&#1614;&#1602;&#1614;&#1577;</text>
  <text x="${W / 2}" y="195" text-anchor="middle" font-family="${fonts.body}" font-size="17" letter-spacing="5" fill="${accent}" opacity="0.75">BAAB AS-SADAQAH</text>

  <text x="${W / 2}" y="270" text-anchor="middle" font-family="${fonts.heading}" font-size="52" font-weight="600" fill="${text}">
    ${escapeXml(honoreeNames || 'In Honour Of')}
  </text>
  ${eventLine ? `<text x="${W / 2}" y="315" text-anchor="middle" font-family="${fonts.body}" font-size="19" letter-spacing="2" fill="${text}" opacity="0.6">${escapeXml(eventLine.toUpperCase())}</text>` : ''}

  <text x="${W / 2}" y="380" text-anchor="middle" font-family="${fonts.body}" font-size="21" font-style="italic" fill="${text}" opacity="0.7">Scan to give sadaqah in our honour</text>

  <!-- QR plate (kept near-white for scan reliability regardless of theme) -->
  <rect x="${qrBoxX}" y="${qrBoxY}" width="${qrBoxSize}" height="${qrBoxSize}" rx="20" fill="#faf8f2"/>
  <rect x="${qrBoxX}" y="${qrBoxY}" width="${qrBoxSize}" height="${qrBoxSize}" rx="20" fill="none" stroke="${accent}" stroke-width="3"/>
  <svg x="${qrBoxX + qrPad}" y="${qrBoxY + qrPad}" width="${qrBoxSize - qrPad * 2}" height="${qrBoxSize - qrPad * 2}" viewBox="${qrViewBox}">
    ${qrInnerSvg}
  </svg>

  <!-- footer -->
  <text x="${W / 2}" y="${qrBoxY + qrBoxSize + 70}" text-anchor="middle" font-family="${fonts.heading}" font-size="24" letter-spacing="6" fill="${accent}">GREEN &#9733; EMBLEM</text>
  <text x="${W / 2}" y="${qrBoxY + qrBoxSize + 102}" text-anchor="middle" font-family="${fonts.body}" font-size="15" letter-spacing="2" fill="${text}" opacity="0.4">green-emblem.com</text>
</svg>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
