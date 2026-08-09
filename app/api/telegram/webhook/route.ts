import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/telegram/webhook — Telegram calls this every time something is
// posted (or edited) in the Green Emblem Telegram channel. Register this
// URL with Telegram once via setWebhook (see docs at the bottom of this file).
//
// Security: Telegram lets you set a `secret_token` when registering the
// webhook, which it echoes back on every request as a header. We verify
// that header matches TELEGRAM_WEBHOOK_SECRET so nobody can post fake
// "updates" by just POSTing to this URL directly.
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = await request.json()
  const post = update.channel_post || update.edited_channel_post
  if (!post) return NextResponse.json({ ok: true }) // not a channel post — nothing to do, still 200 so Telegram doesn't retry

  // Only ingest posts from the actual Green Emblem channel, not any other
  // channel the bot might get added to later.
  const expectedChatId = process.env.TELEGRAM_CHANNEL_ID
  if (expectedChatId && String(post.chat?.id) !== expectedChatId) {
    return NextResponse.json({ ok: true })
  }

  const text: string | null = post.text || post.caption || null
  const postedAt = new Date(post.date * 1000).toISOString() // Telegram sends Unix seconds

  let imageUrl: string | null = null
  if (Array.isArray(post.photo) && post.photo.length > 0) {
    // Telegram sends multiple sizes — the last one is the largest
    const largest = post.photo[post.photo.length - 1]
    imageUrl = await downloadAndRehostPhoto(largest.file_id)
  }

  if (!text && !imageUrl) return NextResponse.json({ ok: true }) // nothing worth storing

  const admin = createAdminClient()
  const { error } = await admin.from('greentv_posts').upsert({
    telegram_message_id: post.message_id,
    text,
    image_url: imageUrl,
    posted_at: postedAt,
  }, { onConflict: 'telegram_message_id' })

  if (error) {
    console.error('Failed to store GreenTV post:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Downloads a Telegram-hosted photo and re-uploads it to Cloudinary.
// We never expose Telegram's raw file URL to the client — it contains the
// bot token in the path.
async function downloadAndRehostPhoto(fileId: string): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  if (!botToken || !cloudName || !uploadPreset) return null

  try {
    // Step 1: ask Telegram where the file actually lives
    const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`)
    const fileInfo = await fileInfoRes.json()
    const filePath = fileInfo?.result?.file_path
    if (!filePath) return null

    const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`

    // Step 2: hand that URL straight to Cloudinary's unsigned upload API —
    // Cloudinary fetches it server-side, so the Telegram URL (with the bot
    // token in it) never touches our own response or the client.
    const form = new URLSearchParams()
    form.set('file', telegramFileUrl)
    form.set('upload_preset', uploadPreset)
    form.set('folder', 'greentv')

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    })
    const uploaded = await uploadRes.json()
    return uploaded?.secure_url || null
  } catch (e) {
    console.error('Photo re-host failed:', e)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ONE-TIME SETUP (not run by this file — do this once from your terminal
// after deploying, with your real bot token and a secret you make up):
//
// curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
//   -d "url=https://green-emblem.com/api/telegram/webhook" \
//   -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
//
// Also add the bot as an ADMIN of the Green Emblem channel (Telegram only
// sends channel_post updates to bots that are channel admins).
// ─────────────────────────────────────────────────────────────────────────
