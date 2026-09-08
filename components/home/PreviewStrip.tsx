import { cn } from '@/lib/utils'

// The inset panel at the foot of each pillar card. One shape for every
// card so the grid reads as a system, whatever the content.
export function PreviewStrip({
  label, value, meta, muted = false, className,
}: {
  label: string
  value: React.ReactNode
  meta?: string | null
  muted?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-5 rounded-lg border border-gold/10 bg-black/15 px-3.5 py-3',
        className
      )}
    >
      <div className="mb-1 font-cinzel text-[8.5px] tracking-[0.2em] text-gold/70">{label}</div>
      <div
        className={cn(
          'font-cormorant text-[14px] leading-snug',
          muted ? 'italic text-white/45' : 'text-white'
        )}
      >
        {value}
      </div>
      {meta && <div className="mt-1 font-cinzel text-[9px] tracking-[0.1em] text-white/35">{meta}</div>}
    </div>
  )
}
