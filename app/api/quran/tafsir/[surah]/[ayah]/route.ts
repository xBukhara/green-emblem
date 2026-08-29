import { NextRequest, NextResponse } from 'next/server'
import { getTafsir } from '@/lib/quran-api'

export const revalidate = 2592000 // 30 days

export async function GET(_request: NextRequest, { params }: { params: { surah: string; ayah: string } }) {
  const surah = Number(params.surah)
  const ayah = Number(params.ayah)
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1) {
    return NextResponse.json({ error: 'Invalid verse' }, { status: 400 })
  }
  try {
    const tafsir = await getTafsir(`${surah}:${ayah}`)
    return NextResponse.json({ tafsir })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load tafsir' }, { status: 502 })
  }
}
