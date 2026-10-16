'use client'

// ── The end-of-ayah ornament ─────────────────────────────────────────────
// A mushaf never ends a verse with a bare numeral — the number sits inside a
// rosette. This draws that rosette as SVG rather than relying on a font
// glyph, so it looks the same whether the official KFGQPC face loaded or the
// reader fell back to Amiri Quran.
//
// The numeral comes straight from the Complex's own text (split off in
// lib/quran-api.ts, where that split is asserted). Nothing is composed here:
// this component receives the digits and draws a frame around them.

export default function AyahMark({ numeral, size = 42 }: { numeral: string; size?: number }) {
  // Wider frame for three-digit numbers so 286 is not cramped.
  const w = numeral.length >= 3 ? size * 1.18 : size

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: w,
        height: size,
        margin: '0 6px',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
      // Screen readers get the verse number as a word, not a decoration.
      role="img"
      aria-label={`End of verse ${numeral}`}
    >
      <svg
        viewBox="0 0 100 100"
        width={w}
        height={size}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Eight-pointed star — two squares at 45° — the traditional khatam
            shape, drawn as outline so the numeral stays legible inside it. */}
        <g fill="none" stroke="var(--gold, #d4af6e)" strokeLinejoin="round">
          <rect x="21" y="21" width="58" height="58" strokeOpacity="0.5" strokeWidth="2.4" />
          <rect
            x="21" y="21" width="58" height="58"
            strokeOpacity="0.5" strokeWidth="2.4"
            transform="rotate(45 50 50)"
          />
          <circle cx="50" cy="50" r="27" strokeOpacity="0.85" strokeWidth="2.6" />
          {/* Four small petals in the gaps, which is what reads as "mushaf"
              rather than "geometric shape". */}
          {[0, 90, 180, 270].map(a => (
            <circle
              key={a}
              cx="50" cy="12" r="3.4"
              strokeOpacity="0.45" strokeWidth="2"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
        </g>
      </svg>

      <span
        style={{
          position: 'relative',
          fontFamily: 'var(--font-uthmani)',
          fontSize: size * 0.34,
          lineHeight: 1,
          color: 'var(--gold, #d4af6e)',
          // The digits are RTL-neutral but sit inside an RTL paragraph; pin
          // the direction so multi-digit numbers never reverse.
          direction: 'ltr',
          unicodeBidi: 'isolate',
        }}
      >
        {numeral}
      </span>
    </span>
  )
}
