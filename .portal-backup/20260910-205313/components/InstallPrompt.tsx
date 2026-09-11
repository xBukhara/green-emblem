'use client'
import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isIos, isStandalone } from '@/lib/push-client'

const DISMISS_KEY = 'ge_install_dismissed_at'
const DISMISS_DAYS = 30

// A quiet, dismissible invitation to install. Appears only after the visitor
// has actually used the site (30s), and stays gone for a month once
// dismissed — an install banner that nags is worse than none.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
      if (at && Date.now() - at < DISMISS_DAYS * 86400000) return
    } catch {}

    // Android / desktop Chrome
    const onPrompt = (e: any) => {
      e.preventDefault()
      setDeferred(e)
      setTimeout(() => setShow(true), 30000)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS never fires that event — it needs manual Share → Add to Home Screen
    if (isIos()) {
      setIosHint(true)
      const t = setTimeout(() => setShow(true), 30000)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt) }
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setDeferred(null)
    dismiss()
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Install Green Emblem"
      className="fixed inset-x-3 bottom-[calc(74px+env(safe-area-inset-bottom,0px))] z-[130] rounded-xl border border-gold/25 bg-forest-deepest/97 p-4 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-[360px]"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center border-none bg-transparent text-white/40 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-2 font-cinzel text-[10px] tracking-[0.2em] text-gold">ADD TO HOME SCREEN</div>
      <p className="mb-3.5 pr-6 font-cormorant text-[15px] italic leading-relaxed text-white/70">
        {iosHint
          ? 'Tap Share, then “Add to Home Screen” — that also lets Green Emblem send you prayer reminders.'
          : 'Open prayer times in one tap, and get reminders when a prayer comes in.'}
      </p>

      {iosHint ? (
        <div className="flex items-center gap-2 font-cinzel text-[10px] tracking-[0.12em] text-white/60">
          <Share className="h-4 w-4 text-gold" />
          Share → Add to Home Screen
        </div>
      ) : (
        <Button variant="brand" size="sm" className="w-full" onClick={install}>
          <Download className="h-4 w-4" />
          Install
        </Button>
      )}
    </div>
  )
}
