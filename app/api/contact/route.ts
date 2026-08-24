import { NextRequest, NextResponse } from 'next/server'
import { sendContactFormToAdmin, sendContactConfirmation } from '@/lib/email'
import { z } from 'zod'

const ContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  topic: z.string().min(1).max(100),
  message: z.string().min(1).max(5000),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please fill in all fields with a valid email.' }, { status: 400 })
  }

  const { name, email, topic, message } = parsed.data

  try {
    await sendContactFormToAdmin({ name, email, topic, message })
  } catch (e) {
    console.error('Contact form admin email failed:', e)
    return NextResponse.json({ error: 'Something went wrong sending your message. Please try again.' }, { status: 500 })
  }

  // Confirmation email is best-effort — don't fail the request if this alone breaks
  sendContactConfirmation({ name, email }).catch(e => console.error('Contact confirmation email failed:', e))

  return NextResponse.json({ success: true })
}
