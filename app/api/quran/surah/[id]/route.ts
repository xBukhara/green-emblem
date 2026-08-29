import { NextRequest, NextResponse } from 'next/server'
import { getSurah } from '@/lib/quran-api'

// Quran text never changes — cache the composed payload aggressively.
export const revalidate = 2592000 // 30 days

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const translationParam = Number(request.nextUrl.searchParams.get('translation'))
  const translationId = Number.isInteger(translationParam) && translationParam > 0 ? translationParam : 131

  try {
    const payload = await getSurah(id, translationId)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=86400' },
    })
  } catch (e: any) {
    // Never fall back to a guess — surface the failure so the reader can
    // show an honest error instead of uncertain text.
    return NextResponse.json({ error: e?.message || 'Failed to load surah' }, { status: 502 })
  }
}
