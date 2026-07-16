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
