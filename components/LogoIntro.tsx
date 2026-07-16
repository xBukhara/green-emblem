'use client'
import { useEffect, useState } from 'react'

// ── Animated logo intro ──────────────────────────────────────────────────
// Storyboard: 1. Fade in (darkness) → 2. Sword rises → 3. Star ignites
//             → 4. Crescent forms → 5. Full emblem + wordmark → fade out.
// Shows once per browser session. Skipped for reduced-motion users.

export default function LogoIntro() {
  const [phase, setPhase] = useState<'hidden' | 'playing' | 'leaving' | 'done'>('hidden')

  useEffect(() => {
    try {
      if (sessionStorage.getItem('ge_intro_seen')) { setPhase('done'); return }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase('done'); return }
      sessionStorage.setItem('ge_intro_seen', '1')
    } catch { setPhase('done'); return }

    setPhase('playing')
    const leave = setTimeout(() => setPhase('leaving'), 3600)
    const done = setTimeout(() => setPhase('done'), 4400)
    return () => { clearTimeout(leave); clearTimeout(done) }
  }, [])

  if (phase === 'hidden' || phase === 'done') return null

  return (
    <div
      aria-hidden="true"
      onClick={() => setPhase('done')}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#060a06',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        opacity: phase === 'leaving' ? 0 : 1,
        transition: 'opacity 0.8s ease',
      }}
    >
      <svg width="180" height="200" viewBox="0 0 200 220" fill="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="ge-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dfe8df"/>
            <stop offset="45%" stopColor="#9fb3a3"/>
            <stop offset="100%" stopColor="#5d7263"/>
          </linearGradient>
          <linearGradient id="ge-steel2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#cdd8cd"/>
            <stop offset="100%" stopColor="#6b8272"/>
          </linearGradient>
          <filter id="ge-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* 2 — SWORD RISES */}
        <g className="ge-sword">
          {/* blade */}
          <path d="M100 18 L106 34 L104 128 L100 140 L96 128 L94 34 Z" fill="url(#ge-steel)"/>
          {/* blade center line */}
          <path d="M100 24 L100 132" stroke="#3c4f42" strokeWidth="1" opacity="0.6"/>
          {/* lower blade taper */}
          <path d="M100 140 L103 152 L100 190 L97 152 Z" fill="url(#ge-steel)"/>
        </g>

        {/* 3 — STAR IGNITES */}
        <g className="ge-star" filter="url(#ge-glow)">
          <path d="M100 118 L106.5 134.5 L124 136 L110.5 147 L115 164 L100 154 L85 164 L89.5 147 L76 136 L93.5 134.5 Z" fill="url(#ge-steel2)"/>
        </g>

        {/* 4 — CRESCENT FORMS (two arcs sweeping around) */}
        <g className="ge-crescent">
          <path
            className="ge-arc ge-arc-l"
            d="M96 40 C 44 52, 26 106, 52 152 C 62 170, 78 182, 95 186"
            stroke="url(#ge-steel2)" strokeWidth="14" strokeLinecap="round" fill="none"
            pathLength={100}
          />
          <path
            className="ge-arc ge-arc-r"
            d="M104 40 C 156 52, 174 106, 148 152 C 138 170, 122 182, 105 186"
            stroke="url(#ge-steel2)" strokeWidth="14" strokeLinecap="round" fill="none"
            pathLength={100}
          />
        </g>
      </svg>

      {/* 5 — WORDMARK */}
      <div className="ge-wordmark" style={{ textAlign: 'center', marginTop: '28px' }}>
        <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '22px', letterSpacing: '0.28em', color: '#e9e4d8', fontWeight: 500 }}>
          GREEN <span style={{ color: '#d4af6e' }}>★</span> EMBLEM
        </div>
        <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.42em', color: 'rgba(233,228,216,0.45)', marginTop: '12px' }}>
          FAITH · STRENGTH · PURPOSE
        </div>
      </div>

      <style>{`
        /* 1. Fade in — the overlay itself starts dark; children animate in */
        .ge-sword {
          opacity: 0;
          transform: translateY(46px);
          animation: geSwordRise 1s cubic-bezier(0.22,1,0.36,1) 0.35s forwards;
        }
        @keyframes geSwordRise {
          to { opacity: 1; transform: translateY(0); }
        }

        /* 3. Star ignites */
        .ge-star {
          opacity: 0;
          transform-origin: 100px 140px;
          transform: scale(0.3);
          animation: geStarIgnite 0.55s cubic-bezier(0.34,1.56,0.64,1) 1.25s forwards;
        }
        @keyframes geStarIgnite {
          0%  { opacity: 0; transform: scale(0.3); }
          60% { opacity: 1; transform: scale(1.18); }
          100%{ opacity: 1; transform: scale(1); }
        }

        /* 4. Crescent sweeps around */
        .ge-arc {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          opacity: 0;
          animation: geArc 0.9s cubic-bezier(0.22,1,0.36,1) 1.85s forwards;
        }
        @keyframes geArc {
          0%   { opacity: 1; stroke-dashoffset: 100; }
          100% { opacity: 1; stroke-dashoffset: 0; }
        }

        /* 5. Wordmark reveals */
        .ge-wordmark {
          opacity: 0;
          transform: translateY(12px);
          animation: geWord 0.7s cubic-bezier(0.22,1,0.36,1) 2.7s forwards;
        }
        @keyframes geWord {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
