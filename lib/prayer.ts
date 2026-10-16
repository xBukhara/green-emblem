import { Coordinates, CalculationMethod, CalculationParameters, Madhab, PrayerTimes, Qibla } from 'adhan'

export const CALC_METHODS = [
  { id: 'MuslimWorldLeague', label: 'Muslim World League' },
  { id: 'Egyptian', label: 'Egyptian General Authority' },
  { id: 'Karachi', label: 'University of Karachi' },
  { id: 'UmmAlQura', label: 'Umm Al-Qura (Makkah)' },
  { id: 'Dubai', label: 'Dubai' },
  { id: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
  { id: 'NorthAmerica', label: 'ISNA (North America)' },
  { id: 'Kuwait', label: 'Kuwait' },
  { id: 'Qatar', label: 'Qatar' },
  { id: 'Singapore', label: 'Singapore' },
  { id: 'Tehran', label: 'Tehran' },
  { id: 'Turkey', label: 'Turkey (Diyanet)' },
] as const

export type CalcMethodId = typeof CALC_METHODS[number]['id']

// ── The calculation method is fixed: ISNA (North America) ───────────────
// Deliberately not user-selectable. ISNA is the standard across North
// America, and a picker only invites people to change a number they have no
// way to check — then wonder why the app disagrees with their masjid.
//
// The Shafi/Hanafi Asr toggle is a SEPARATE thing and stays. That is a fiqh
// choice, not a calculation method, and removing it would hand Hanafi users
// an Asr they consider wrong with no way to correct it.
//
// CALC_METHODS above is no longer surfaced in the UI. It is kept so the
// ids stay typed and documented — if you ever expose a picker again, that
// is a product decision, not a refactor.
export const CALC_METHOD: CalcMethodId = 'NorthAmerica'

function getParams(methodId: CalcMethodId, madhab: 'shafi' | 'hanafi'): CalculationParameters {
  const fn = (CalculationMethod as any)[methodId] || CalculationMethod.MuslimWorldLeague
  const params: CalculationParameters = fn()
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi
  return params
}

export type DayPrayerTimes = {
  fajr: Date
  sunrise: Date
  dhuhr: Date
  asrShafi: Date
  asrHanafi: Date
  maghrib: Date
  isha: Date
}

export function computeDayTimes(lat: number, lng: number, date: Date, methodId: CalcMethodId = CALC_METHOD): DayPrayerTimes {
  const coords = new Coordinates(lat, lng)
  const shafiTimes = new PrayerTimes(coords, date, getParams(methodId, 'shafi'))
  const hanafiTimes = new PrayerTimes(coords, date, getParams(methodId, 'hanafi'))
  return {
    fajr: shafiTimes.fajr,
    sunrise: shafiTimes.sunrise,
    dhuhr: shafiTimes.dhuhr,
    asrShafi: shafiTimes.asr,
    asrHanafi: hanafiTimes.asr,
    maghrib: shafiTimes.maghrib,
    isha: shafiTimes.isha,
  }
}

export function qiblaBearing(lat: number, lng: number): number {
  return Qibla(new Coordinates(lat, lng))
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Ordered list for display + "which prayer is next" logic. Only one Asr
// entry here — the caller decides which madhab's Asr to treat as primary
// for "next prayer" purposes; both are always shown in the table either way.
export function orderedPrayers(times: DayPrayerTimes, primaryAsr: 'shafi' | 'hanafi') {
  const asr = primaryAsr === 'hanafi' ? times.asrHanafi : times.asrShafi
  return [
    { key: 'fajr', label: 'Fajr', time: times.fajr },
    { key: 'sunrise', label: 'Sunrise', time: times.sunrise },
    { key: 'dhuhr', label: 'Dhuhr', time: times.dhuhr },
    { key: 'asr', label: 'Asr', time: asr },
    { key: 'maghrib', label: 'Maghrib', time: times.maghrib },
    { key: 'isha', label: 'Isha', time: times.isha },
  ]
}
