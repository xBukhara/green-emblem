import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://green-emblem.com'
  const campaignUrl = `${appUrl}/give/${params.slug}`

  try {
    const qrBuffer = await QRCode.toBuffer(campaignUrl, {
      type:   'png',
      width:  800,
      margin: 2,
      color:  {
        dark:  '#0f1f0f', // Forest green/dark
        light: '#f5f0e6', // Cream background
      },
      errorCorrectionLevel: 'H', // High — survives printing wear
    })

    return new NextResponse(new Uint8Array(qrBuffer), {
      headers: {
        'Content-Type':        'image/png',
        'Content-Disposition': `attachment; filename="green-emblem-qr-${params.slug}.png"`,
        'Cache-Control':       'public, max-age=86400',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
