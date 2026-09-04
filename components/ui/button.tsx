'use client'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer no-underline [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-px active:translate-y-0',
        // The signature Green Emblem CTA — Cinzel, wide tracking, gold
        brand:       'bg-gold text-forest-dark font-cinzel text-[11px] tracking-wider2 hover:opacity-90 hover:-translate-y-px active:translate-y-0',
        outline:     'border border-gold/50 bg-transparent text-gold font-cinzel text-[11px] tracking-wider2 hover:bg-gold/10 hover:border-gold hover:-translate-y-px',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:       'text-foreground/70 hover:bg-white/5 hover:text-foreground',
        link:        'text-gold underline-offset-4 hover:underline',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm:      'h-9 px-4 text-xs',
        default: 'h-10 px-5 py-2',
        lg:      'h-12 px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
