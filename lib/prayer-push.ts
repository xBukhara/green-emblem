import 'server-only'
import { computeDayTimes, orderedPrayers, type CalcMethodId } from '@/lib/prayer'

export type PrayerSub = {
  endpoint: string
  p256dh: string
  auth: string
  lat: number | null
  lng: number | null
  timezone: string | null
  calc_method: string | null
  madhab: string | null
}

const PRAYER_LABEL: Record<string, string> = {
  fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
}

// Format a Date in a specific IANA zone — the server runs in UTC, so every
// user-facing time has to be rendered in *their* zone or it is simply wrong.
export function timeIn(date: Date, timeZone: string): string {
  try {
    return date.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
}

// The calendar date in the user's own zone, as YYYY-MM-DD. Used as the
// dedupe key so "today" means today where they are.
export function localDateKey(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function usable(s: PrayerSub): boolean {
  return s.lat != null && s.lng != null && !!s.timezone
}

export function dayTimesFor(s: PrayerSub, when: Date) {
  const method = (s.calc_method || 'MuslimWorldLeague') as CalcMethodId
  const madhab = s.madhab === 'hanafi' ? 'hanafi' : 'shafi'
  const times = computeDayTimes(s.lat!, s.lng!, when, method)
  return orderedPrayers(times, madhab).filter(p => p.key !== 'sunrise')
}

// "Fajr 5:42 · Dhuhr 1:02 · Asr 4:31 · Maghrib 7:14 · Isha 8:33"
export function digestBody(s: PrayerSub, when: Date): string {
  return dayTimesFor(s, when)
    .map(p => `${PRAYER_LABEL[p.key] || p.label} ${timeIn(p.time, s.timezone!)}`)
    .join(' · ')
}

// Which prayer, if any, falls inside [now, now + windowMinutes)?
export function prayerDueNow(s: PrayerSub, now: Date, windowMinutes: number) {
  for (const p of dayTimesFor(s, now)) {
    const delta = (p.time.getTime() - now.getTime()) / 60000
    if (delta >= 0 && delta < windowMinutes) {
      return { key: p.key, label: PRAYER_LABEL[p.key] || p.label, time: p.time }
    }
  }
  return null
}
