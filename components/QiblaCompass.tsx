'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// ── Qibla compass ────────────────────────────────────────────────────────
// PERFORMANCE NOTE (this is why the previous version was unusably laggy):
// device orientation events fire ~60×/second. The old implementation called
// setState on every one of them, so React re-rendered a 30-node SVG (24 tick
// lines + 8 counter-rotated labels, each recomputing transform-origin) sixty
// times a second, and a CSS transition fought the incoming updates on top of
// that. The main thread never caught up.
//
// Here the sensor only ever writes to a ref. A single requestAnimationFrame
// loop eases the displayed angle toward that target and writes positions
// straight to the DOM. React re-renders only when something genuinely
// changes state (permission, alignment, tilt) — a few times a minute, not
// sixty times a second. Labels are repositioned by setting x/y rather than
// rotating them, which avoids transform-origin layout work entirely.

const R = 100   // dial radius
const C = 130   // svg centre
const SIZE = 260

const CARDINALS = [
  { deg: 0,   t: 'N',  big: true },
  { deg: 45,  t: 'NE', big: false },
  { deg: 90,  t: 'E',  big: true },
  { deg: 135, t: 'SE', big: false },
  { deg: 180, t: 'S',  big: true },
  { deg: 225, t: 'SW', big: false },
  { deg: 270, t: 'W',  big: true },
  { deg: 315, t: 'NW', big: false },
]

// Shortest signed difference a→b, in (-180, 180]
function angleDelta(a: number, b: number) {
  let d = (b - a) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

const polar = (angleDeg: number, radius: number) => {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) }
}

export default function QiblaCompass({ bearing }: { bearing: number }) {
  // ── Live values that must never trigger a render ──
  const targetHeading = useRef<number | null>(null)  // smoothed sensor heading
  const displayHeading = useRef(0)                   // eased, what's drawn
  const hasSensor = useRef(false)
  const tiltRef = useRef(0)

  // ── DOM handles written to directly each frame ──
  const dialRef = useRef<SVGGElement>(null)
  const kaabaRef = useRef<SVGGElement>(null)
  const labelRefs = useRef<(SVGTextElement | null)[]>([])
  const readoutRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()

  // ── Genuine state — changes rarely ──
  const [live, setLive] = useState(false)
  const [aligned, setAligned] = useState(false)
  const [tilted, setTilted] = useState(false)
  const [needsPermission, setNeedsPermission] = useState(false)
  const [error, setError] = useState('')
  const [calibrating, setCalibrating] = useState(false)

  const alignedRef = useRef(false)
  const tiltedRef = useRef(false)
  const calibTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Sensor → ref only ──────────────────────────────────────────────────
  const onOrientation = useCallback((e: any) => {
    let raw: number | null = null

    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      raw = e.webkitCompassHeading                     // iOS: already true heading
    } else if (e.absolute === true && typeof e.alpha === 'number') {
      raw = 360 - e.alpha                              // alpha runs counter-clockwise
    } else if (typeof e.alpha === 'number') {
      raw = 360 - e.alpha                              // non-absolute: relative, still useful
    }
    if (raw == null) return

    // Compensate for landscape / upside-down screen orientation
    const screenAngle =
      (typeof screen !== 'undefined' && (screen as any).orientation?.angle) ??
      (window as any).orientation ?? 0
    raw = (raw + screenAngle + 360) % 360

    // Low-pass filter, wrap-aware
    const prev = targetHeading.current
    targetHeading.current = prev == null
      ? raw
      : (prev + angleDelta(prev, raw) * 0.25 + 360) % 360

    if (!hasSensor.current) {
      hasSensor.current = true
      displayHeading.current = targetHeading.current
      setLive(true)
    }

    // Tilt: compass readings are meaningless unless the phone is roughly
    // flat. beta = front/back tilt, gamma = left/right roll.
    const beta = typeof e.beta === 'number' ? e.beta : 0
    const gamma = typeof e.gamma === 'number' ? e.gamma : 0
    tiltRef.current = Math.max(Math.abs(beta), Math.abs(gamma))
  }, [])

  const onNeedsCalibration = useCallback(() => {
    setCalibrating(true)
    if (calibTimer.current) clearTimeout(calibTimer.current)
    calibTimer.current = setTimeout(() => setCalibrating(false), 4000)
  }, [])

  // ── The single animation loop ──────────────────────────────────────────
  useEffect(() => {
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const target = targetHeading.current
      if (target != null) {
        // Ease toward the target along the shortest arc — smooth regardless
        // of whether the sensor reports at 10Hz or 120Hz.
        const d = angleDelta(displayHeading.current, target)
        displayHeading.current = (displayHeading.current + d * 0.2 + 360) % 360
      }
      const h = target == null ? 0 : displayHeading.current

      // Rotate the dial body (ring + ticks) — one cheap transform
      if (dialRef.current) {
        dialRef.current.setAttribute('transform', `rotate(${-h} ${C} ${C})`)
      }

      // Reposition labels rather than counter-rotating them: they stay
      // upright and no transform-origin work is needed.
      for (let i = 0; i < CARDINALS.length; i++) {
        const el = labelRefs.current[i]
        if (!el) continue
        const p = polar(CARDINALS[i].deg - h, R - 28)
        el.setAttribute('x', p.x.toFixed(2))
        el.setAttribute('y', p.y.toFixed(2))
      }

      // Kaaba marker sits at the qibla bearing, seen from the current heading
      if (kaabaRef.current) {
        kaabaRef.current.setAttribute('transform', `rotate(${bearing - h} ${C} ${C})`)
      }

      // Alignment + tilt: only touch React when the boolean actually flips
      if (target != null) {
        const off = Math.abs(angleDelta(h, bearing))
        const nowAligned = off < 6
        if (nowAligned !== alignedRef.current) {
          alignedRef.current = nowAligned
          setAligned(nowAligned)
        }
        const nowTilted = tiltRef.current > 35
        if (nowTilted !== tiltedRef.current) {
          tiltedRef.current = nowTilted
          setTilted(nowTilted)
        }
        if (readoutRef.current) {
          readoutRef.current.textContent = nowAligned
            ? 'Facing the Qibla'
            : `${Math.round(off)}° to go — facing ${Math.round(h)}°`
        }
      }
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [bearing])

  // ── Attach sensors ─────────────────────────────────────────────────────
  const attach = useCallback(() => {
    window.addEventListener('deviceorientationabsolute', onOrientation, true)
    window.addEventListener('deviceorientation', onOrientation, true)
    window.addEventListener('compassneedscalibration', onNeedsCalibration as any, true)
  }, [onOrientation, onNeedsCalibration])

  useEffect(() => {
    const DOE: any = typeof window !== 'undefined' ? (window as any).DeviceOrientationEvent : null
    if (!DOE) { setError('This device doesn’t report orientation — use the bearing below with a compass.'); return }

    // iOS requires a user gesture before it will hand over the compass.
    if (typeof DOE.requestPermission === 'function') {
      setNeedsPermission(true)
    } else {
      attach()
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrientation, true)
      window.removeEventListener('deviceorientation', onOrientation, true)
      window.removeEventListener('compassneedscalibration', onNeedsCalibration as any, true)
      if (calibTimer.current) clearTimeout(calibTimer.current)
    }
  }, [attach, onOrientation, onNeedsCalibration])

  const grantPermission = async () => {
    setError('')
    const DOE: any = (window as any).DeviceOrientationEvent
    try {
      const res = await DOE.requestPermission()
      if (res !== 'granted') { setError('Compass access was denied. You can still use the bearing below.'); return }
      setNeedsPermission(false)
      attach()
    } catch {
      setError('Couldn’t start the compass on this device.')
    }
  }

  const accent = aligned ? '#2ecc71' : 'var(--gold)'

  return (
    <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: '14px' }}>QIBLA DIRECTION</div>

      {calibrating && (
        <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: '#e8b923', marginBottom: '10px' }}>
          Move your phone in a figure-8 to calibrate
        </div>
      )}
      {live && tilted && !calibrating && (
        <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: '#e8b923', marginBottom: '10px' }}>
          Hold your phone flat for an accurate reading
        </div>
      )}

      <div style={{ width: `${SIZE}px`, height: `${SIZE}px`, margin: '0 auto 18px', maxWidth: '100%' }}>
        <svg
          width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ display: 'block', touchAction: 'none' }}
          role="img" aria-label={`Qibla is ${bearing.toFixed(0)} degrees from north`}
        >
          <defs>
            <radialGradient id="qiblaDial" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="rgba(212,175,110,0.07)"/>
              <stop offset="100%" stopColor="rgba(212,175,110,0)"/>
            </radialGradient>
            <filter id="qiblaGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          <circle cx={C} cy={C} r={R + 18} fill="url(#qiblaDial)"/>

          {/* Rotating dial body — ring + ticks. One transform per frame. */}
          <g ref={dialRef} style={{ willChange: 'transform' }}>
            <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(212,175,110,0.3)" strokeWidth="1"/>
            <circle cx={C} cy={C} r={R - 14} fill="none" stroke="rgba(212,175,110,0.1)" strokeWidth="1"/>
            {Array.from({ length: 24 }, (_, i) => i * 15).map(deg => (
              <line
                key={deg} x1={C} y1={C - R} x2={C} y2={C - R + (deg % 30 === 0 ? 10 : 5)}
                stroke="rgba(212,175,110,0.35)" strokeWidth={deg % 90 === 0 ? 2 : 1}
                transform={`rotate(${deg} ${C} ${C})`}
              />
            ))}
          </g>

          {/* Cardinal labels — repositioned each frame, never rotated */}
          {CARDINALS.map((c, i) => {
            const p = polar(c.deg, R - 28)
            return (
              <text
                key={c.t}
                ref={el => { labelRefs.current[i] = el }}
                x={p.x} y={p.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={c.big ? 15 : 10} fontWeight={c.big ? 700 : 400}
                fill={c.t === 'N' ? '#e0574f' : c.big ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)'}
                fontFamily="var(--font-inter)"
                style={{ willChange: 'transform' }}
              >
                {c.t}
              </text>
            )
          })}

          {/* Kaaba marker at the qibla bearing */}
          <g ref={kaabaRef} transform={`rotate(${bearing} ${C} ${C})`} style={{ willChange: 'transform' }}>
            <g filter={aligned ? 'url(#qiblaGlow)' : undefined}>
              <circle cx={C} cy={C - R + 2} r="13" fill={aligned ? '#2ecc71' : 'var(--gold)'} style={{ transition: 'fill 0.25s' }}/>
              <rect x={C - 6} y={C - R - 4} width="12" height="10" fill="#14210f"/>
              <rect x={C - 6} y={C - R - 4} width="12" height="3" fill="#c9a227"/>
            </g>
          </g>

          {/* Fixed pointer — where the phone is aimed */}
          <polygon
            points={`${C},${C - R - 22} ${C - 7},${C - R - 4} ${C + 7},${C - R - 4}`}
            fill={aligned ? '#2ecc71' : '#fff'} style={{ transition: 'fill 0.25s' }}
          />
          <circle cx={C} cy={C} r="4" fill="rgba(255,255,255,0.6)"/>
        </svg>
      </div>

      <div
        ref={readoutRef}
        style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: accent, marginBottom: '4px', transition: 'color 0.25s', minHeight: '20px' }}
      >
        {bearing.toFixed(1)}° from North
      </div>

      <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', marginBottom: needsPermission || error ? '16px' : 0 }}>
        {live
          ? 'Turn until the Kaaba marker meets the arrow at the top.'
          : 'Align this bearing using a compass, or start the live compass below.'}
      </p>

      {needsPermission && (
        <button onClick={grantPermission} style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 20px', cursor: 'pointer' }}>
          Start live compass
        </button>
      )}
      {error && <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(226,75,74,0.85)', marginTop: '10px' }}>{error}</p>}
    </div>
  )
}
