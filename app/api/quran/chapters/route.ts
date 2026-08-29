import { NextResponse } from 'next/server'
import { getChapters } from '@/lib/quran-api'

export const revalidate = 86400

export async function GET() {
  try {
    return NextResponse.json({ chapters: await getChapters() })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load chapters' }, { status: 502 })
  }
}
