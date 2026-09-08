import type { Config } from 'tailwindcss'

// ── Green Emblem × shadcn/ui ─────────────────────────────────────────────
// The brand palette drives the shadcn semantic tokens, so components look
// like Green Emblem out of the box rather than default shadcn slate.
//
// preflight is DELIBERATELY OFF. app/globals.css already ships its own
// reset, and the site's existing pages are built with inline styles that a
// second global reset would visibly break. Components are migrated to
// Tailwind page by page; nothing has to move all at once.

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        // ── Brand ──
        forest: {
          DEFAULT: '#1b3f1b',   // card / raised surface
          dark:    '#143314',   // page background (lighter than the old #0f1f0f)
          deepest: '#0e250e',   // nav, footer, deepest chrome
          raised:  '#234c23',   // hover / elevated
          mid:     '#2e6b2e',
          light:   '#5a9e5a',
        },
        gold: {
          DEFAULT: '#d4af6e',
          light:   '#f0d48a',
          dim:     '#a07840',
        },
        cream:  '#f5f0e6',
        violet: '#9b8ec4',

        // ── shadcn semantic tokens (HSL vars in globals.css) ──
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary:   { DEFAULT: 'hsl(var(--primary))',   foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive:{ DEFAULT:'hsl(var(--destructive))',foreground: 'hsl(var(--destructive-foreground))' },
        muted:     { DEFAULT: 'hsl(var(--muted))',     foreground: 'hsl(var(--muted-foreground))' },
        accent:    { DEFAULT: 'hsl(var(--accent))',    foreground: 'hsl(var(--accent-foreground))' },
        popover:   { DEFAULT: 'hsl(var(--popover))',   foreground: 'hsl(var(--popover-foreground))' },
        card:      { DEFAULT: 'hsl(var(--card))',      foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        cinzel:    ['var(--font-cinzel)', 'Palatino Linotype', 'serif'],
        cormorant: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans:      ['var(--font-inter)', 'system-ui', 'sans-serif'],
        arabic:    ['var(--font-arabic)', 'serif'],
        uthmani:   ['var(--font-uthmani)', 'serif'],
      },
      letterSpacing: {
        brand: '0.22em',
        wider2: '0.16em',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-up':        { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-up':        'fade-up 0.35s cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
