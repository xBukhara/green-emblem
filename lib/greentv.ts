// ── Shared guard for the greentv_posts moderation column ────────────────
// `hidden_at` arrives via greentv-moderation.sql. Until that migration runs,
// every query that filters on the column is rejected by PostgREST with
// 42703 (undefined_column) — which, on 2026-10-16, blanked the whole GreenTV
// feed and the homepage headline at once and looked exactly like data loss.
//
// So the two public read paths now ask for the filter, and fall back to an
// unfiltered query on this one specific error. The fallback is safe because
// it is narrowly scoped: if the column does not exist, then nothing can have
// been hidden, so there is nothing the filter would have removed. Any other
// error still surfaces as an error — a transient failure must never be
// allowed to quietly reveal posts someone removed on purpose.

export const UNDEFINED_COLUMN = '42703'

export function isMissingHiddenAt(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  if (e.code === UNDEFINED_COLUMN) return true
  const msg = String(e.message || '')
  return /hidden_at/.test(msg) && /does not exist|could not find/i.test(msg)
}

export const MIGRATION_HINT =
  'greentv_posts.hidden_at is missing — run greentv-moderation.sql in Supabase. ' +
  'Serving the feed unfiltered until then.'
