import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/server'
import { buildQrCardSvg } from '@/lib/campaign-design'

// GET /api/campaigns/[slug]/qr-card?format=png|svg
// A printable QR card styled with the same colorway, pattern and font pairing
// the organizer chose in the design studio — not just a plain black-on-white
// QR square.
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const { searchParams } = new URL(request.url)
  const format = (searchParams.get('format') || 'png').toLowerCase()

  const admin = createAdminClient()
  const { data: campaign, error } = await admin
    .from('campaigns')
    .select('slug, honoree_names, event_type, event_date, theme')
    .eq('slug', params.slug)
    .maybeSingle()

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://green-emblem.com'
  const campaignUrl = `${appUrl}/give/${campaign.slug}`

  const theme = (campaign.theme || {}) as Record<string, any>
  const bg = theme.bg || '#0f1f0f'
  const accent = theme.accent || '#d4af6e'
  const text = theme.text || '#f5f0e6'
  const pattern = theme.pattern || 'star8'
  const patternOpacity = theme.pattern_opacity ?? 0.07
  const fontPair = theme.font_pair || 'cinzel'

  // Generate the QR as raw SVG markup (vector — stays crisp at any print size)
  let qrSvgRaw: string
  try {
    qrSvgRaw = await QRCode.toString(campaignUrl, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'H',
      color: { dark: '#14210f', light: '#00000000' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }

  const viewBoxMatch = qrSvgRaw.match(/viewBox="([^"]+)"/)
  const pathMatch = qrSvgRaw.match(/<path[^>]*\/>/)
  const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 33 33'
  const qrInnerSvg = pathMatch ? pathMatch[0] : ''

  const cardSvg = buildQrCardSvg({
    bg, accent, text, fontPair, pattern, patternOpacity,
    honoreeNames: campaign.honoree_names,
    eventType: campaign.event_type,
    eventDate: campaign.event_date,
    qrInnerSvg, qrViewBox,
  })

  if (format === 'svg') {
    return new NextResponse(cardSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `attachment; filename="green-emblem-qr-card-${campaign.slug}.svg"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  // PNG (default) — rasterize the SVG for people who just want to print
  // straight from Photos/Preview without design software.
  try {
    const sharp = (await import('sharp')).default
    const pngBuffer = await sharp(Buffer.from(cardSvg), { density: 220 })
      .png()
      .toBuffer()

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="green-emblem-qr-card-${campaign.slug}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('QR card PNG rasterization failed:', err)
    // Fall back to the vector version rather than a hard failure
    return new NextResponse(cardSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `attachment; filename="green-emblem-qr-card-${campaign.slug}.svg"`,
      },
    })
  }
}
