import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ExtractedEvent = {
  title: string
  description: string | null
  event_start: string   // ISO 8601
  event_end: string      // ISO 8601
}

// Strip a webpage down to readable text — drops scripts, styles, nav/footer
// chrome — so the LLM sees roughly what a human visitor sees, not markup noise.
function extractReadableText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, svg, noscript, iframe').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  return text.slice(0, 15000) // keep prompts small — cost + context control
}

// Fetch a masjid's website and ask Claude to pull out any event/program
// listings as structured JSON. Returns [] (not an error) if the page loads
// fine but genuinely has no events on it right now.
export async function syncMasjidEvents(websiteUrl: string, masjidName: string): Promise<{
  events: ExtractedEvent[]
  error?: string
}> {
  let html: string
  try {
    const res = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'GreenEmblemEventBot/1.0 (+https://green-emblem.com)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { events: [], error: `Site returned ${res.status}` }
    html = await res.text()
  } catch (e: any) {
    return { events: [], error: `Could not fetch site: ${e.message}` }
  }

  const pageText = extractReadableText(html)
  if (!pageText || pageText.length < 50) {
    return { events: [], error: 'Page has little to no readable text (may require JavaScript to render)' }
  }

  const now = new Date().toISOString()

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: `You extract community event listings from masjid/Islamic center website text. Today's date is ${now}. Only extract events that are clearly upcoming or ongoing (not past events, unless still relevant for reference). Respond with ONLY a JSON array, no markdown fences, no commentary. Each item: {"title": string, "description": string or null, "event_start": ISO 8601 datetime, "event_end": ISO 8601 datetime}. If you cannot determine a specific time, use a reasonable default (e.g. 12:00 for an all-day event). If the end time isn't stated, estimate 2 hours after start. If there are genuinely no events/programs mentioned, respond with exactly: []`,
      messages: [{
        role: 'user',
        content: `Website: ${masjidName}\n\nPage text:\n${pageText}`,
      }],
    })
  } catch (e: any) {
    return { events: [], error: `AI extraction failed: ${e.message}` }
  }

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return { events: [], error: 'No response from model' }

  let parsed: any
  try {
    // Defensive: strip markdown fences if the model added them despite instructions
    const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
    parsed = JSON.parse(cleaned)
  } catch {
    return { events: [], error: 'Model response was not valid JSON' }
  }

  if (!Array.isArray(parsed)) return { events: [], error: 'Model response was not a JSON array' }

  const events: ExtractedEvent[] = parsed
    .filter(e => e && typeof e.title === 'string' && e.event_start && e.event_end)
    .map(e => ({
      title: String(e.title).slice(0, 200),
      description: e.description ? String(e.description).slice(0, 1000) : null,
      event_start: e.event_start,
      event_end: e.event_end,
    }))
    .filter(e => !isNaN(Date.parse(e.event_start)) && !isNaN(Date.parse(e.event_end)))

  return { events }
}
