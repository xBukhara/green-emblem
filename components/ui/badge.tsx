import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 font-cinzel text-[9px] tracking-[0.14em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-gold/30 bg-gold/10 text-gold',
        green:   'border-forest-mid/30 bg-forest-mid/15 text-forest-light',
        violet:  'border-violet/30 bg-violet/10 text-violet',
        muted:   'border-white/15 bg-white/5 text-white/60',
        destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
