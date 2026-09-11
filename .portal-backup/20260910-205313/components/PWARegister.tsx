'use client'
import { useEffect } from 'react'

// Registers the service worker once, on every page. Silent by design —
// a failed registration should never surface to the user.
export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'development') return   // avoid stale SW during dev

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
    // Wait for load so the SW never competes with first paint for bandwidth
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
