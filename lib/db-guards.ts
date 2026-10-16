// ── Guards for reads that depend on a migration ──────────────────────────
// Shipping code that hard-depends on a SQL migration, with no graceful
// degradation, once blanked the GreenTV feed and looked exactly like data
// loss (claude/greentv-moderation.md). Every feature added since asks these
// questions instead of assuming its tables exist.
//
// The fallbacks built on these are always narrow: if the relation does not
// exist then the feature has no data, so hiding the feature is correct and
// reveals nothing. Any OTHER error still surfaces as an error.

export const UNDEFINED_TABLE = '42P01'
export const UNDEFINED_COLUMN = '42703'

export function isMissingSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  if (e.code === UNDEFINED_TABLE || e.code === UNDEFINED_COLUMN) return true
  const msg = String(e.message || '')
  return /does not exist|could not find the table|schema cache/i.test(msg)
}
