import { NextResponse } from 'next/server'
import { getTranslations } from '@/lib/quran-api'

export const revalidate = 86400

export async function GET() {
  return NextResponse.json({ translations: await getTranslations() })
}
