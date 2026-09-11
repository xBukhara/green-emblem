#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  GREEN EMBLEM — MASJID PORTAL, PHASE 1
#
#  Run from the root of your green-emblem project:
#      bash apply-masjid-portal.sh
#
#  It writes every file, then verifies each one landed intact and exits
#  non-zero if anything is missing. Nothing is deleted; existing files
#  that this replaces are backed up to .portal-backup/ first.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

if [ ! -f package.json ] || [ ! -d app ]; then
  echo "✗ Run this from the root of the green-emblem project (where package.json is)."
  exit 1
fi

BACKUP=".portal-backup/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
echo "→ Backing up any files being replaced to $BACKUP"
echo

save() { # save <path>
  if [ -f "$1" ]; then
    mkdir -p "$BACKUP/$(dirname "$1")"
    cp "$1" "$BACKUP/$1"
  fi
  mkdir -p "$(dirname "$1")"
}

echo "  writing masjid-portal.sql"
save 'masjid-portal.sql'
cat > 'masjid-portal.sql' <<'GE_EOF_109D7169'
-- ═══════════════════════════════════════════════════════════════════
--  GREEN EMBLEM — MASJID PORTAL (Phase 1)
--  Run in the Supabase SQL Editor. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Masjid profile fields the portal lets them manage ───────────────
alter table masjids add column if not exists slug            text;
alter table masjids add column if not exists description     text;
alter table masjids add column if not exists logo_url        text;
alter table masjids add column if not exists hero_url        text;
alter table masjids add column if not exists contact_email   text;
alter table masjids add column if not exists jumuah_times    text;
alter table masjids add column if not exists office_hours    text;
alter table masjids add column if not exists donation_url    text;

create unique index if not exists masjids_slug_key on masjids (slug) where slug is not null;

-- Backfill slugs for any masjid that doesn't have one
update masjids
set slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || substr(id::text, 1, 6)
where slug is null;

-- 2. Who can administer a masjid ─────────────────────────────────────
-- A masjid can have several people (imam, admin, youth coordinator).
create table if not exists masjid_members (
  id         uuid primary key default gen_random_uuid(),
  masjid_id  uuid not null references masjids(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'editor',    -- 'owner' | 'editor'
  created_at timestamptz not null default now(),
  unique (masjid_id, user_id)
);
create index if not exists masjid_members_user_idx on masjid_members (user_id);

-- 3. Invitations ─────────────────────────────────────────────────────
-- You create these from the admin console. The invitee sets their own
-- password — no password is ever generated, transmitted, or seen by staff.
create table if not exists masjid_invites (
  id          uuid primary key default gen_random_uuid(),
  masjid_id   uuid not null references masjids(id) on delete cascade,
  email       text not null,
  token       text not null unique,
  role        text not null default 'owner',
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists masjid_invites_token_idx on masjid_invites (token) where accepted_at is null;

-- 4. Posts — one table, four kinds ───────────────────────────────────
create table if not exists masjid_posts (
  id           uuid primary key default gen_random_uuid(),
  masjid_id    uuid not null references masjids(id) on delete cascade,
  type         text not null check (type in ('event','fundraiser','program','youth')),
  title        text not null,
  body         text,
  image_url    text,
  status       text not null default 'published' check (status in ('draft','published','archived')),
  published_at timestamptz,

  -- event / youth
  starts_at    timestamptz,
  ends_at      timestamptz,
  location     text,
  rsvp_enabled boolean not null default true,

  -- fundraiser. Money never flows through Green Emblem: donate_url points
  -- at the masjid's own donation page, and goal/raised are self-reported.
  goal_amount    numeric(12,2),
  raised_amount  numeric(12,2) default 0,
  donate_url     text,
  deadline       date,

  -- program (recurring)
  schedule_text  text,          -- e.g. "Every Saturday, 11am–1pm"

  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists masjid_posts_masjid_idx on masjid_posts (masjid_id, status, starts_at desc);
create index if not exists masjid_posts_feed_idx   on masjid_posts (status, published_at desc);

-- 5. RSVPs — "Going" only, by design ─────────────────────────────────
-- There is deliberately no "not going" state. Removing the row is how a
-- person withdraws; the app never records or displays non-attendance.
create table if not exists post_rsvps (
  post_id    uuid not null references masjid_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_rsvps_post_idx on post_rsvps (post_id);

-- 6. Row-level security ──────────────────────────────────────────────
alter table masjid_members enable row level security;
alter table masjid_invites enable row level security;
alter table masjid_posts   enable row level security;
alter table post_rsvps     enable row level security;

-- Helper: is the current user an administrator of this masjid?
create or replace function is_masjid_member(p_masjid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from masjid_members
    where masjid_id = p_masjid and user_id = auth.uid()
  );
$$;

drop policy if exists "members read own rows" on masjid_members;
create policy "members read own rows" on masjid_members
  for select using (user_id = auth.uid() or is_masjid_member(masjid_id));

drop policy if exists "admins manage members" on masjid_members;
create policy "admins manage members" on masjid_members
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Invites are never readable by the client; acceptance goes through the
-- API with the service role, which validates the token.
drop policy if exists "admins manage invites" on masjid_invites;
create policy "admins manage invites" on masjid_invites
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Anyone may read published posts; masjid staff see their own drafts too.
drop policy if exists "read published posts" on masjid_posts;
create policy "read published posts" on masjid_posts
  for select using (status = 'published' or is_masjid_member(masjid_id));

drop policy if exists "masjid staff write posts" on masjid_posts;
create policy "masjid staff write posts" on masjid_posts
  for all using (is_masjid_member(masjid_id)) with check (is_masjid_member(masjid_id));

drop policy if exists "platform admins manage posts" on masjid_posts;
create policy "platform admins manage posts" on masjid_posts
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- RSVP counts are public; the roster is visible to the person themselves
-- and to the masjid's own staff.
drop policy if exists "read rsvps" on post_rsvps;
create policy "read rsvps" on post_rsvps
  for select using (
    user_id = auth.uid()
    or exists (select 1 from masjid_posts p where p.id = post_id and is_masjid_member(p.masjid_id))
  );

drop policy if exists "own rsvp" on post_rsvps;
create policy "own rsvp" on post_rsvps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7. Public RSVP count — avoids exposing the roster to read a number ──
create or replace function post_rsvp_count(p_post uuid)
returns integer language sql security definer stable set search_path = public as $$
  select count(*)::int from post_rsvps where post_id = p_post;
$$;

create or replace function posts_rsvp_counts(p_posts uuid[])
returns table (post_id uuid, going integer)
language sql security definer stable set search_path = public as $$
  select post_id, count(*)::int as going
  from post_rsvps
  where post_id = any(p_posts)
  group by post_id;
$$;

grant execute on function post_rsvp_count(uuid)    to anon, authenticated;
grant execute on function posts_rsvp_counts(uuid[]) to anon, authenticated;

-- 8. Keep updated_at honest ──────────────────────────────────────────
create or replace function touch_masjid_post()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists masjid_posts_touch on masjid_posts;
create trigger masjid_posts_touch before update on masjid_posts
  for each row execute function touch_masjid_post();
GE_EOF_109D7169

echo "  writing middleware.ts"
save 'middleware.ts'
cat > 'middleware.ts' <<'GE_EOF_30629866'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Hostname routing ─────────────────────────────────────────────────────
// masjid.green-emblem.com serves the masjid portal; everything else serves
// the consumer app. One deployment, one database — the portal has to write
// events that appear instantly in GreenWorld+ and push to followers, so
// splitting it into a second project would only mean duplicating auth, the
// database client and the push layer.
//
// Rewrites (not redirects) so the portal's URLs stay clean:
//   masjid.green-emblem.com/posts  ->  /portal/posts  internally
//
// Set PORTAL_HOST in Vercel to override for a preview deployment.
const PORTAL_HOSTS = new Set(
  [process.env.NEXT_PUBLIC_PORTAL_HOST, 'masjid.green-emblem.com', 'masjid.localhost']
    .filter(Boolean)
    .map(h => String(h).toLowerCase())
)

function isPortalHost(hostname: string) {
  const host = hostname.toLowerCase().split(':')[0]
  return PORTAL_HOSTS.has(host) || host.startsWith('masjid.')
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  if (isPortalHost(host)) {
    // API routes and Next internals are shared — never rewrite those.
    if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return supabaseResponse

    // Already pointed at the portal tree
    if (pathname.startsWith('/portal')) return supabaseResponse

    const url = request.nextUrl.clone()
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`
    const rewritten = NextResponse.rewrite(url, { request })
    supabaseResponse.cookies.getAll().forEach(c => rewritten.cookies.set(c))
    return rewritten
  }

  // On the main site, /portal is not a public path — send people to the
  // portal's own hostname rather than exposing the internal route.
  if (pathname.startsWith('/portal')) {
    const portalHost = process.env.NEXT_PUBLIC_PORTAL_HOST || 'masjid.green-emblem.com'
    return NextResponse.redirect(
      new URL(pathname.replace(/^\/portal/, '') || '/', `https://${portalHost}`)
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
GE_EOF_30629866

echo "  writing lib/portal.ts"
save 'lib/portal.ts'
cat > 'lib/portal.ts' <<'GE_EOF_580C43D7'
import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ── Portal auth helpers ──────────────────────────────────────────────────
// Every portal API route funnels through requireMasjidMember(), so there is
// exactly one place that decides whether someone may act for a masjid.

export type MasjidMembership = {
  userId: string
  masjidId: string
  role: string
  masjidName: string
}

export async function userFromRequest(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  return user
}

// Resolves the caller's masjid. Returns null when they administer none —
// membership is never taken from the request body, only from the database.
export async function requireMasjidMember(request: Request): Promise<MasjidMembership | null> {
  const user = await userFromRequest(request)
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('masjid_members')
    .select('masjid_id, role, masjids(name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    userId: user.id,
    masjidId: (data as any).masjid_id,
    role: (data as any).role,
    masjidName: (data as any).masjids?.name || 'Your masjid',
  }
}

export async function isPlatformAdmin(request: Request): Promise<string | null> {
  const user = await userFromRequest(request)
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin' ? user.id : null
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

export function portalOrigin(): string {
  const host = process.env.NEXT_PUBLIC_PORTAL_HOST || 'masjid.green-emblem.com'
  return host.includes('localhost') ? `http://${host}` : `https://${host}`
}
GE_EOF_580C43D7

echo "  writing lib/surface.ts"
save 'lib/surface.ts'
cat > 'lib/surface.ts' <<'GE_EOF_FC5CC641'
// ── Which surface is this? ───────────────────────────────────────────────
// One Next build serves three surfaces:
//   • the consumer app            (green-emblem.com/*)
//   • the platform admin console  (/admin/*)
//   • the masjid portal           (masjid.green-emblem.com/* → /portal/*)
//
// Consumer chrome — the mobile tab bar, the install banner, the service
// worker — is mounted in the ROOT layout, so a nested layout cannot remove
// it. Each of those components asks this helper to step aside instead.
//
// IMPORTANT: the portal is identified by HOSTNAME, not by path. The
// middleware *rewrites* masjid.green-emblem.com/posts to /portal/posts
// internally, and a rewrite is invisible to the client router — in the
// browser `usePathname()` there returns "/posts", never "/portal/posts".
// Matching on the path alone silently misses the entire portal.
//
// Keep this the single source of truth. Adding a surface in one component
// and forgetting another is exactly how the tab bar ended up floating over
// the portal.

// Mirrors the list in middleware.ts. NEXT_PUBLIC_ so it is inlined into the
// client bundle too — the middleware's own copy is server-side only.
const PORTAL_HOSTS = [
  process.env.NEXT_PUBLIC_PORTAL_HOST,
  'masjid.green-emblem.com',
  'masjid.localhost',
]
  .filter(Boolean)
  .map(h => String(h).toLowerCase().split(':')[0])

export function isPortalHost(hostname?: string | null): boolean {
  const host = (hostname || '').toLowerCase().split(':')[0]
  if (!host) return false
  return PORTAL_HOSTS.includes(host) || host.startsWith('masjid.')
}

const NON_CONSUMER_PATHS = ['/admin', '/portal']

function isNonConsumerPath(pathname?: string | null): boolean {
  if (!pathname) return false
  // Exact match or a real path segment — '/administrators' is not '/admin'.
  return NON_CONSUMER_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/**
 * True when this page should carry consumer chrome.
 *
 * Client components must pass the live hostname; during SSR there is none,
 * so the answer is "consumer" and the portal's own layout suppresses the
 * chrome with CSS before first paint (see hideConsumerChromeCss). Once
 * hydrated, this returns false on the portal and the elements unmount.
 */
export function isConsumerSurface(pathname?: string | null, hostname?: string | null): boolean {
  if (isPortalHost(hostname)) return false
  return !isNonConsumerPath(pathname)
}

/**
 * Rendered by the portal layout on the server. Static pages cannot read
 * request headers, so this is what keeps the consumer tab bar from flashing
 * over the portal in the frame before hydration.
 */
export const HIDE_CONSUMER_CHROME_CSS = `
  nav[aria-label="Primary"],
  [data-consumer-chrome] { display: none !important; }
  body { padding-bottom: 0 !important; }
`
GE_EOF_FC5CC641

echo "  writing lib/email.ts"
save 'lib/email.ts'
cat > 'lib/email.ts' <<'GE_EOF_B7E0F2D7'
// lib/email.ts
// All transactional emails sent via Resend
import { Resend } from 'resend'

// Lazily construct the Resend client so importing this module never throws.
// `new Resend(undefined)` throws "Missing API key", and Next.js imports every
// API route at BUILD time while collecting page data — a module-scope
// constructor crash here breaks the whole Vercel deployment, which silently
// pins production to the last successful build. Lazy init + a no-op guard
// means: build always succeeds, and if RESEND_API_KEY is missing at runtime
// emails are skipped (logged) instead of crashing the request.
let _resend: Resend | null = null
const resend = {
  emails: {
    send: (payload: Parameters<Resend['emails']['send']>[0]) => {
      if (!process.env.RESEND_API_KEY) {
        console.warn('[email] RESEND_API_KEY not set — skipping email:', (payload as any)?.subject)
        return Promise.resolve({ data: null, error: { message: 'RESEND_API_KEY not set', name: 'missing_api_key' } } as any)
      }
      if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
      return _resend.emails.send(payload)
    },
  },
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'fizzah@greenemblem.com'
const FROM = process.env.EMAIL_FROM || 'Green Emblem <noreply@green-emblem.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://green-emblem.com'

// Shared header HTML for all emails
const emailHeader = (title: string) => `
  <div style="background:#0f1f0f;padding:20px 32px;border-radius:12px 12px 0 0">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-family:'Cinzel',serif;font-size:14px;letter-spacing:0.2em;color:#d4af6e">
        Green Emblem
      </span>
    </div>
    <h1 style="color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:400;margin:12px 0 0">${title}</h1>
  </div>
`

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:24px;background:#f5f0e6;font-family:Georgia,serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid rgba(46,107,46,0.15)">
    ${content}
    <div style="background:#0f1f0f;padding:16px 32px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.1em;margin:0">
        BARAKALLAHU FEEKUM · GREEN EMBLEM · GREEN-EMBLEM.COM
      </p>
    </div>
  </div>
</body>
</html>
`

// ─── 6. ORDER CONFIRMATION → CUSTOMER ─────────────────────────────────────────
export async function sendOrderConfirmation(data: {
  customerEmail: string
  customerName?: string
  orderNumber: string
  orderType: string
  items: Array<{ name: string; qty: number; price: number }>
  total: number
  shippingMethod?: string
  estimatedDelivery?: string
}) {
  const itemRows = data.items.map(item =>
    `<tr>
      <td style="padding:8px 0;color:#333;border-bottom:1px solid #eee">${item.name}</td>
      <td style="padding:8px 0;color:#666;text-align:center;border-bottom:1px solid #eee">×${item.qty}</td>
      <td style="padding:8px 0;color:#333;text-align:right;border-bottom:1px solid #eee">$${(item.price * item.qty).toFixed(2)}</td>
    </tr>`
  ).join('')

  await resend.emails.send({
    from: FROM,
    to: data.customerEmail,
    subject: `Order confirmed — ${data.orderNumber} · Green Emblem`,
    html: emailWrapper(`
      ${emailHeader(`Order ${data.orderNumber} confirmed`)}
      <div style="padding:24px 32px">
        <p style="font-size:15px;line-height:1.7;color:#333">
          ${data.customerName ? `Assalamu Alaikum ${data.customerName},` : 'Assalamu Alaikum,'}
        </p>
        <p style="font-size:15px;line-height:1.7;color:#333">Your order has been confirmed and is being prepared with care.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <thead>
            <tr style="background:#f5f0e6">
              <th style="padding:10px;text-align:left;color:#7a5c1e;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Item</th>
              <th style="padding:10px;text-align:center;color:#7a5c1e;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Qty</th>
              <th style="padding:10px;text-align:right;color:#7a5c1e;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:10px 0;font-weight:bold;color:#333">Total</td>
              <td style="padding:10px 0;font-weight:bold;color:#333;text-align:right">$${data.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        ${data.shippingMethod ? `
          <div style="background:#f5f5f5;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;color:#555">
            <strong>Shipping:</strong> ${data.shippingMethod}
            ${data.estimatedDelivery ? ` · Estimated delivery: ${data.estimatedDelivery}` : ''}
          </div>
        ` : ''}
        <a href="${APP_URL}/dashboard"
           style="background:#2e6b2e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;margin-top:12px">
          Track your order
        </a>
        <p style="font-size:13px;color:#888;font-style:italic;margin-top:20px">
          Barak Allahu feekum. May Allah bless your celebration.
        </p>
      </div>
    `),
  })
}

// ─── 7. NEW ORDER NOTIFICATION → ADMIN ───────────────────────────────────────
export async function sendNewOrderToAdmin(data: {
  orderNumber: string
  customerEmail: string
  orderType: string
  total: number
  items: Array<{ name: string; qty: number }>
  eventType?: string
  quantity?: number
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New order ${data.orderNumber} — $${data.total.toFixed(2)} · ${data.orderType}`,
    html: emailWrapper(`
      ${emailHeader(`New order: ${data.orderNumber}`)}
      <div style="padding:24px 32px">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:5px 0;color:#666;width:140px">Order</td><td style="padding:5px 0;font-weight:bold">${data.orderNumber}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Type</td><td style="padding:5px 0">${data.orderType}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Customer</td><td style="padding:5px 0"><a href="mailto:${data.customerEmail}" style="color:#2e6b2e">${data.customerEmail}</a></td></tr>
          <tr><td style="padding:5px 0;color:#666">Total</td><td style="padding:5px 0;font-weight:bold;color:#2e6b2e">$${data.total.toFixed(2)}</td></tr>
          ${data.eventType ? `<tr><td style="padding:5px 0;color:#666">Event</td><td style="padding:5px 0">${data.eventType}</td></tr>` : ''}
          ${data.quantity ? `<tr><td style="padding:5px 0;color:#666">Bags</td><td style="padding:5px 0">${data.quantity}</td></tr>` : ''}
        </table>
        <a href="${APP_URL}/admin?panel=orders"
           style="background:#2e6b2e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;margin-top:16px">
          View in admin console
        </a>
      </div>
    `),
  })
}

// ─── 8. CAMPAIGN REQUEST → ADMIN ─────────────────────────────────────────────
export async function sendCampaignRequestToAdmin(data: {
  id: string
  firstName: string
  lastName: string
  email: string
  eventType: string
  honoreeNames: string
  eventDate?: string
  guestCount?: number
  qrTier: string
  message?: string
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `Baab As-Sadaqah request — ${data.honoreeNames} · ${data.qrTier === 'premium' ? 'PREMIUM QR' : 'Free QR'}`,
    html: emailWrapper(`
      ${emailHeader('New Campaign Request')}
      <div style="padding:24px 32px">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:5px 0;color:#666;width:140px">Name</td><td style="padding:5px 0;font-weight:bold">${data.firstName} ${data.lastName}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Email</td><td style="padding:5px 0"><a href="mailto:${data.email}" style="color:#2e6b2e">${data.email}</a></td></tr>
          <tr><td style="padding:5px 0;color:#666">Event</td><td style="padding:5px 0">${data.eventType}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Honourees</td><td style="padding:5px 0">${data.honoreeNames}</td></tr>
          ${data.eventDate ? `<tr><td style="padding:5px 0;color:#666">Date</td><td style="padding:5px 0">${data.eventDate}</td></tr>` : ''}
          ${data.guestCount ? `<tr><td style="padding:5px 0;color:#666">Guests</td><td style="padding:5px 0">~${data.guestCount}</td></tr>` : ''}
          <tr><td style="padding:5px 0;color:#666">QR tier</td><td style="padding:5px 0"><strong style="color:${data.qrTier === 'premium' ? '#d4af6e' : '#2e6b2e'}">${data.qrTier.toUpperCase()}</strong></td></tr>
        </table>
        ${data.message ? `<div style="background:#f5f5f5;border-radius:8px;padding:14px;margin:16px 0"><p style="font-size:12px;color:#666;margin:0 0 6px">Message:</p><p style="margin:0;line-height:1.6;color:#333;font-style:italic">${data.message}</p></div>` : ''}
        <a href="${APP_URL}/admin?panel=sadaqah&id=${data.id}&action=approve"
           style="background:#2e6b2e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;margin-top:16px">
          Approve &amp; send magic link
        </a>
      </div>
    `),
  })
}

// ─── 9. MAGIC LINK → CAMPAIGN ORGANISER ──────────────────────────────────────
export async function sendMagicLink(data: {
  firstName: string
  email: string
  magicToken: string
  honoreeNames: string
}) {
  const magicUrl = `${APP_URL}/campaigns/build?token=${data.magicToken}`

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Your Green Emblem campaign is approved — build it now`,
    html: emailWrapper(`
      ${emailHeader('Your campaign is approved')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Barak Allahu feekum! Your Baab As-Sadaqah campaign for <strong>${data.honoreeNames}</strong> has been approved.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Click the button below to design your campaign page, choose your Islamic theme, and generate your QR code. This link is unique to your campaign.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${magicUrl}"
             style="background:#d4af6e;color:#0f1f0f;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:16px;display:inline-block;font-weight:bold;letter-spacing:0.04em">
            Build my campaign →
          </a>
        </div>
        <p style="font-size:12px;color:#999;text-align:center;line-height:1.6">
          This link is private and unique to you. Do not share it.<br/>
          It expires in 7 days. If you need a new link, contact us.
        </p>
      </div>
    `),
  })
}

export async function sendCampaignActivated(data: {
  firstName: string
  email: string
  honoreeNames: string
  eventType: string
  campaignSlug: string
  qrDownloadUrl: string
}) {
  const campaignUrl = `${process.env.NEXT_PUBLIC_APP_URL}/give/${data.campaignSlug}`
  const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/${data.campaignSlug}/qr`

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Green Emblem <onboarding@resend.dev>',
    to: data.email,
    subject: `Your Baab As-Sadaqah campaign is live — ${data.honoreeNames}`,
    html: emailWrapper(`
      ${emailHeader('Your campaign is live!')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Alhamdulillah! Your Baab As-Sadaqah campaign for <strong>${data.honoreeNames}</strong> is now live and ready to share.
        </p>
        <div style="background:#f5f0e6;border-radius:10px;padding:16px 20px;margin:20px 0;border-left:3px solid #d4af6e">
          <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.15em;color:#2e6b2e;margin-bottom:6px">YOUR CAMPAIGN LINK</div>
          <div style="font-size:14px;color:#333;word-break:break-all">${campaignUrl}</div>
        </div>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Share this link with your guests, or download your QR code to place on tables, in programmes, and on display boards at your event.
        </p>
        <div style="text-align:center;margin:28px 0;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="${campaignUrl}" style="background:#d4af6e;color:#0f1f0f;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;display:inline-block;font-weight:bold">
            View my campaign →
          </a>
          <a href="${qrUrl}" style="background:#0f1f0f;color:#d4af6e;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;display:inline-block;border:1px solid #d4af6e">
            Download QR code
          </a>
        </div>
        <p style="font-size:14px;line-height:1.7;color:#888">
          Your campaign will remain active for 30 days. You can view live donation stats on your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color:#2e6b2e">dashboard</a> at any time.
        </p>
        <div style="text-align:center;margin:20px 0;font-size:18px;color:#2e6b2e;font-family:serif">
          تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
        </div>
      </div>
    `),
  })
}


export async function sendCampaignEnded(data: {
  firstName: string
  email: string
  honoreeNames: string
  eventType: string
  campaignSlug: string
  totalRaised: number
  donorCount: number
  mealsFunded: number
}) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Green Emblem <onboarding@resend.dev>',
    to: data.email,
    subject: `MashaAllah — your campaign for ${data.honoreeNames} has ended`,
    html: emailWrapper(`
      ${emailHeader('JazakAllahu Khairan')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          MashaAllah! Your Baab As-Sadaqah campaign for <strong>${data.honoreeNames}</strong> has come to a close.
          Here is a summary of the barakah your event generated:
        </p>

        <div style="background:#f5f0e6;border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center">
          <div style="display:flex;justify-content:center;gap:32px;flex-wrap:wrap">
            <div style="text-align:center">
              <div style="font-size:32px;font-weight:bold;color:#2e6b2e">$${data.totalRaised.toFixed(2)}</div>
              <div style="font-size:12px;color:#666;letter-spacing:0.1em;margin-top:4px">RAISED</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:32px;font-weight:bold;color:#2e6b2e">${data.donorCount}</div>
              <div style="font-size:12px;color:#666;letter-spacing:0.1em;margin-top:4px">DONORS</div>
            </div>
            ${data.mealsFunded > 0 ? `<div style="text-align:center">
              <div style="font-size:32px;font-weight:bold;color:#2e6b2e">${data.mealsFunded}</div>
              <div style="font-size:12px;color:#666;letter-spacing:0.1em;margin-top:4px">MEALS FUNDED</div>
            </div>` : ''}
          </div>
        </div>

        <p style="font-size:15px;line-height:1.8;color:#333;font-style:italic;border-left:3px solid #d4af6e;padding-left:16px;margin:20px 0">
          "The Prophet ﷺ said: 'When a person dies, his deeds come to an end except for three: 
          ongoing charity (sadaqah jariyah), knowledge that is benefited from, and a righteous child who prays for him.'"
          <br/><span style="font-size:12px;color:#888">— Sahih Muslim</span>
        </p>

        <p style="font-size:15px;line-height:1.7;color:#333">
          Every meal funded, every dollar given in the names of your honourees — these are deeds that endure.
          May Allah accept it from you and from them, and may He bless the occasion it was given for.
        </p>

        <div style="text-align:center;margin:24px 0;font-size:20px;color:#2e6b2e;font-family:serif">
          تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
        </div>
        <div style="text-align:center;font-size:13px;color:#888;margin-bottom:20px;font-style:italic">
          May Allah accept from us and from you.
        </div>

        <div style="text-align:center;margin:24px 0">
          <a href="${dashboardUrl}" style="background:#d4af6e;color:#0f1f0f;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;display:inline-block;font-weight:bold">
            View your impact dashboard →
          </a>
        </div>

        <p style="font-size:13px;line-height:1.7;color:#888;text-align:center">
          Planning another event? <a href="${process.env.NEXT_PUBLIC_APP_URL}/sadaqah/request" style="color:#2e6b2e">Request a new campaign</a> anytime.
        </p>
      </div>
    `),
  })
}

// ─── NEW MASJID EVENT → FOLLOWERS ─────────────────────────────────────────
export async function sendNewEventNotification(data: {
  email: string
  firstName?: string
  masjidName: string
  eventTitle: string
  eventDescription?: string
  eventStart: string   // ISO string
  eventEnd: string      // ISO string
}) {
  const start = new Date(data.eventStart)
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `New event at ${data.masjidName}: ${data.eventTitle}`,
    html: emailWrapper(`
      ${emailHeader('New community event')}
      <div style="padding:32px">
        <p style="font-size:15px;color:#333">Assalamu Alaikum${data.firstName ? ` ${data.firstName}` : ''},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          <strong>${data.masjidName}</strong>, a masjid you follow on Green Emblem, just posted a new event:
        </p>
        <div style="background:#f5f0e6;border-radius:10px;padding:18px 20px;margin:20px 0">
          <div style="font-size:17px;color:#0f1f0f;font-weight:bold;margin-bottom:6px">${data.eventTitle}</div>
          <div style="font-size:13px;color:#2e6b2e;margin-bottom:10px">${dateStr} · ${timeStr}</div>
          ${data.eventDescription ? `<p style="font-size:14px;color:#555;line-height:1.6;margin:0">${data.eventDescription}</p>` : ''}
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${APP_URL}/greenworld-plus" style="background:#d4af6e;color:#0f1f0f;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;font-weight:bold">
            See all local events →
          </a>
        </div>
        <p style="font-size:12px;color:#999;text-align:center">
          You're getting this because you follow ${data.masjidName} on GreenWorld+. You can unfollow anytime from your account page.
        </p>
      </div>
    `),
  })
}

// ─── CONTACT FORM → ADMIN ──────────────────────────────────────────────────
export async function sendContactFormToAdmin(data: {
  name: string
  email: string
  topic: string
  message: string
}) {
  return resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    reply_to: data.email,
    subject: `[Contact] ${data.topic} — ${data.name}`,
    html: emailWrapper(`
      ${emailHeader('New contact form message')}
      <div style="padding:32px">
        <p style="font-size:13px;color:#999;margin-bottom:4px">From</p>
        <p style="font-size:15px;color:#333;margin-bottom:16px"><strong>${data.name}</strong> — ${data.email}</p>
        <p style="font-size:13px;color:#999;margin-bottom:4px">Topic</p>
        <p style="font-size:15px;color:#333;margin-bottom:16px">${data.topic}</p>
        <p style="font-size:13px;color:#999;margin-bottom:4px">Message</p>
        <p style="font-size:15px;color:#333;line-height:1.7;white-space:pre-wrap">${data.message}</p>
      </div>
    `),
  })
}

// ─── CONTACT FORM → SUBMITTER (confirmation) ───────────────────────────────
export async function sendContactConfirmation(data: { name: string; email: string }) {
  return resend.emails.send({
    from: FROM,
    to: data.email,
    subject: 'We received your message — Green Emblem',
    html: emailWrapper(`
      ${emailHeader('Message received')}
      <div style="padding:32px">
        <p style="font-size:15px;color:#333">Assalamu Alaikum ${data.name},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Thank you for reaching out to Green Emblem. We've received your message and will get back to you as soon as we can.
        </p>
        <p style="font-size:13px;color:#999;margin-top:24px">
          This is an automated confirmation — no need to reply to this email.
        </p>
      </div>
    `),
  })
}

// ── Masjid portal invitation ─────────────────────────────────────────────
export async function sendMasjidInvite(data: { email: string; masjidName: string; link: string }) {
  return resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `You've been invited to manage ${data.masjidName} on Green Emblem`,
    html: emailWrapper(`
      ${emailHeader('Your masjid dashboard')}
      <div style="padding:28px 32px">
        <p style="font-family:Georgia,serif;font-size:15px;color:#333;line-height:1.7;margin:0 0 18px">
          Assalamu alaikum,
        </p>
        <p style="font-family:Georgia,serif;font-size:15px;color:#333;line-height:1.7;margin:0 0 18px">
          You've been invited to manage <strong>${data.masjidName}</strong> on Green Emblem.
          From your dashboard you can post events, fundraisers, programs and youth
          announcements — and anyone following your masjid is notified straight away.
        </p>
        <p style="font-family:Georgia,serif;font-size:15px;color:#333;line-height:1.7;margin:0 0 24px">
          Set your password to get started. This link works once and expires in seven days.
        </p>
        <p style="margin:0 0 26px">
          <a href="${data.link}" style="display:inline-block;background:#d4af6e;color:#143314;font-family:Georgia,serif;font-size:13px;letter-spacing:0.12em;text-decoration:none;padding:14px 30px;border-radius:8px">
            Set your password
          </a>
        </p>
        <p style="font-family:Georgia,serif;font-size:12px;color:#888;line-height:1.6;margin:0">
          If the button doesn't work, paste this into your browser:<br/>
          <span style="color:#2e6b2e;word-break:break-all">${data.link}</span>
        </p>
        <p style="font-family:Georgia,serif;font-size:12px;color:#888;line-height:1.6;margin:18px 0 0">
          Didn't expect this? You can ignore the email — nothing happens until the link is used.
        </p>
      </div>
    `),
  })
}
GE_EOF_B7E0F2D7

echo "  writing app/api/portal/invite/route.ts"
save 'app/api/portal/invite/route.ts'
cat > 'app/api/portal/invite/route.ts' <<'GE_EOF_14268925'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isPlatformAdmin, randomToken, portalOrigin } from '@/lib/portal'
import { sendMasjidInvite } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST /api/portal/invite { masjid_id, email, role }
// Platform-admin only. Creates a single-use, 7-day invitation and emails it.
// No password is ever generated here — the invitee sets their own.
export async function POST(request: NextRequest) {
  const adminId = await isPlatformAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { masjid_id, email, role } = await request.json().catch(() => ({}))
  if (!masjid_id || !email) {
    return NextResponse.json({ error: 'masjid_id and email are required' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That email address looks wrong' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: masjid } = await db.from('masjids').select('name').eq('id', masjid_id).maybeSingle()
  if (!masjid) return NextResponse.json({ error: 'Masjid not found' }, { status: 404 })

  // Supersede any outstanding invite for this address so only the newest
  // link works.
  await db.from('masjid_invites')
    .delete()
    .eq('masjid_id', masjid_id)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)

  const token = randomToken()
  const { error } = await db.from('masjid_invites').insert({
    masjid_id,
    email: email.toLowerCase(),
    token,
    role: role === 'editor' ? 'editor' : 'owner',
    created_by: adminId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const link = `${portalOrigin()}/invite/${token}`
  const mail = await sendMasjidInvite({ email, masjidName: masjid.name, link })

  return NextResponse.json({
    ok: true,
    link,                       // shown in the admin UI so you can send it manually if needed
    emailed: !mail?.error,
  })
}
GE_EOF_14268925

echo "  writing app/api/portal/invite/accept/route.ts"
save 'app/api/portal/invite/accept/route.ts'
cat > 'app/api/portal/invite/accept/route.ts' <<'GE_EOF_0BAE3A2D'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/portal/invite/accept?token=… — what is this invite for?
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const db = createAdminClient()
  const { data } = await db
    .from('masjid_invites')
    .select('email, expires_at, accepted_at, masjids(name)')
    .eq('token', token)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'invalid' }, { status: 404 })
  if (data.accepted_at) return NextResponse.json({ error: 'used' }, { status: 410 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'expired' }, { status: 410 })

  return NextResponse.json({
    email: data.email,
    masjidName: (data as any).masjids?.name || 'your masjid',
  })
}

// POST /api/portal/invite/accept { token, password }
// Creates (or links) the account, sets the password the invitee chose, and
// grants membership. The token is consumed in the same transaction-ish flow.
export async function POST(request: NextRequest) {
  const { token, password } = await request.json().catch(() => ({}))
  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (String(password).length < 10) {
    return NextResponse.json({ error: 'Use at least 10 characters.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: invite } = await db
    .from('masjid_invites')
    .select('id, masjid_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'This invitation is not valid.' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'This invitation has already been used.' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired. Ask for a new one.' }, { status: 410 })
  }

  // The email may already have a Green Emblem account (they might be a
  // regular user too) — link it rather than failing.
  let userId: string | null = null
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  })

  if (created?.user) {
    userId = created.user.id
  } else if (createErr) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existing = list?.users?.find(u => (u.email || '').toLowerCase() === invite.email)
    if (!existing) return NextResponse.json({ error: createErr.message }, { status: 500 })
    // Accepting an invite re-sets the password for that address, which is
    // the behaviour the invitee expects.
    await db.auth.admin.updateUserById(existing.id, { password })
    userId = existing.id
  }
  if (!userId) return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })

  // profiles row may be created by a trigger; upsert defensively
  await db.from('profiles').upsert({ id: userId, email: invite.email }, { onConflict: 'id' })

  const { error: memberErr } = await db.from('masjid_members').upsert(
    { masjid_id: invite.masjid_id, user_id: userId, role: invite.role },
    { onConflict: 'masjid_id,user_id' }
  )
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  await db.from('masjid_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true, email: invite.email })
}
GE_EOF_0BAE3A2D

echo "  writing app/api/portal/posts/route.ts"
save 'app/api/portal/posts/route.ts'
cat > 'app/api/portal/posts/route.ts' <<'GE_EOF_C3049F98'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireMasjidMember } from '@/lib/portal'
import { sendToSubscriptions, getSubscriptionsForUsers } from '@/lib/push-server'

export const dynamic = 'force-dynamic'

const TYPES = new Set(['event', 'fundraiser', 'program', 'youth'])

// GET /api/portal/posts — this masjid's posts, newest first
export async function GET(request: NextRequest) {
  const member = await requireMasjidMember(request)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('masjid_posts')
    .select('*')
    .eq('masjid_id', member.masjidId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach RSVP counts without exposing the roster
  const ids = (data || []).map(p => p.id)
  let counts: Record<string, number> = {}
  if (ids.length) {
    const { data: rows } = await db.rpc('posts_rsvp_counts', { p_posts: ids })
    counts = Object.fromEntries((rows || []).map((r: any) => [r.post_id, r.going]))
  }

  return NextResponse.json({
    posts: (data || []).map(p => ({ ...p, going: counts[p.id] || 0 })),
    masjid: { id: member.masjidId, name: member.masjidName },
  })
}

// POST /api/portal/posts — create. Published immediately (invited masjids
// are already vetted), and followers are pushed straight away.
export async function POST(request: NextRequest) {
  const member = await requireMasjidMember(request)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  if (!TYPES.has(b.type)) return NextResponse.json({ error: 'Unknown post type' }, { status: 400 })
  if (!b.title?.trim()) return NextResponse.json({ error: 'A title is required' }, { status: 400 })

  if ((b.type === 'event' || b.type === 'youth') && !b.starts_at) {
    return NextResponse.json({ error: 'Events need a start date and time' }, { status: 400 })
  }
  if (b.type === 'fundraiser' && b.donate_url && !/^https?:\/\//i.test(b.donate_url)) {
    return NextResponse.json({ error: 'The donation link must start with http:// or https://' }, { status: 400 })
  }

  const status = b.status === 'draft' ? 'draft' : 'published'
  const row = {
    masjid_id: member.masjidId,
    type: b.type,
    title: String(b.title).slice(0, 200),
    body: b.body ? String(b.body).slice(0, 5000) : null,
    image_url: b.image_url || null,
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
    starts_at: b.starts_at || null,
    ends_at: b.ends_at || null,
    location: b.location || null,
    rsvp_enabled: b.rsvp_enabled !== false,
    goal_amount: b.goal_amount ?? null,
    raised_amount: b.raised_amount ?? 0,
    donate_url: b.donate_url || null,
    deadline: b.deadline || null,
    schedule_text: b.schedule_text || null,
    created_by: member.userId,
  }

  const db = createAdminClient()
  const { data: post, error } = await db.from('masjid_posts').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Push to followers — best effort, never blocks the response.
  if (status === 'published') {
    ;(async () => {
      try {
        const { data: followers } = await db
          .from('profiles').select('id').eq('followed_masjid_id', member.masjidId)
        const subs = await getSubscriptionsForUsers(
          (followers || []).map((f: any) => f.id), 'notify_masjid_events'
        )
        if (!subs.length) return
        const when = post.starts_at
          ? new Date(post.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : null
        await sendToSubscriptions(subs, {
          title: member.masjidName,
          body: when ? `${post.title} · ${when}` : post.title,
          url: `/greenworld-plus?post=${post.id}`,
          tag: `ge-post-${post.id}`,
          renotify: true,
        })
      } catch (e) {
        console.warn('[portal] push failed', e)
      }
    })()
  }

  return NextResponse.json({ post }, { status: 201 })
}
GE_EOF_C3049F98

echo "  writing app/api/portal/posts/[id]/route.ts"
save 'app/api/portal/posts/[id]/route.ts'
cat > 'app/api/portal/posts/[id]/route.ts' <<'GE_EOF_E459D507'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireMasjidMember } from '@/lib/portal'

export const dynamic = 'force-dynamic'

// Every handler re-checks that the post belongs to the caller's masjid —
// membership alone is not enough to touch an arbitrary post id.
async function ownPost(request: NextRequest, id: string) {
  const member = await requireMasjidMember(request)
  if (!member) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const db = createAdminClient()
  const { data: post } = await db.from('masjid_posts').select('*').eq('id', id).maybeSingle()
  if (!post) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (post.masjid_id !== member.masjidId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { member, post, db }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownPost(request, params.id)
  if (r.error) return r.error

  const { data: attendees } = await r.db!
    .from('post_rsvps')
    .select('created_at, profiles:user_id(full_name, email)')
    .eq('post_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ post: r.post, attendees: attendees || [] })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownPost(request, params.id)
  if (r.error) return r.error

  const b = await request.json().catch(() => ({}))
  const allowed = [
    'title', 'body', 'image_url', 'status', 'starts_at', 'ends_at', 'location',
    'rsvp_enabled', 'goal_amount', 'raised_amount', 'donate_url', 'deadline', 'schedule_text',
  ]
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in b) updates[k] = b[k]
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  // Moving a draft to published stamps the publish time once
  if (updates.status === 'published' && !r.post!.published_at) {
    updates.published_at = new Date().toISOString()
  }

  const { data, error } = await r.db!
    .from('masjid_posts').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

// Archive rather than hard-delete, so RSVPs and history survive.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownPost(request, params.id)
  if (r.error) return r.error
  await r.db!.from('masjid_posts').update({ status: 'archived' }).eq('id', params.id)
  return NextResponse.json({ ok: true })
}
GE_EOF_E459D507

echo "  writing app/api/posts/[id]/rsvp/route.ts"
save 'app/api/posts/[id]/rsvp/route.ts'
cat > 'app/api/posts/[id]/rsvp/route.ts' <<'GE_EOF_3E112975'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── RSVP: "Going" only, by design ────────────────────────────────────────
// There is no "not going" state anywhere in this API. Withdrawing deletes
// the row; non-attendance is never recorded or counted. Toggling off is
// necessary — without it headcounts inflate and stop being useful to the
// masjid — but it is not the same as a skip button.

async function caller(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  return user
}

// GET — public count, plus whether the caller is going
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const pub = createPublicClient()
  const { data: count } = await pub.rpc('post_rsvp_count', { p_post: params.id })

  let going = false
  const user = await caller(request)
  if (user) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('post_rsvps').select('post_id')
      .eq('post_id', params.id).eq('user_id', user.id).maybeSingle()
    going = !!data
  }
  return NextResponse.json({ count: count ?? 0, going })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await caller(request)
  if (!user) return NextResponse.json({ error: 'Please sign in to RSVP.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: post } = await admin
    .from('masjid_posts').select('id, rsvp_enabled, status').eq('id', params.id).maybeSingle()
  if (!post || post.status !== 'published') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!post.rsvp_enabled) return NextResponse.json({ error: 'RSVP is closed for this post.' }, { status: 400 })

  await admin.from('post_rsvps').upsert(
    { post_id: params.id, user_id: user.id }, { onConflict: 'post_id,user_id' }
  )
  const { data: count } = await admin.rpc('post_rsvp_count', { p_post: params.id })
  return NextResponse.json({ going: true, count: count ?? 0 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await caller(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('post_rsvps').delete().eq('post_id', params.id).eq('user_id', user.id)
  const { data: count } = await admin.rpc('post_rsvp_count', { p_post: params.id })
  return NextResponse.json({ going: false, count: count ?? 0 })
}
GE_EOF_3E112975

echo "  writing app/portal/layout.tsx"
save 'app/portal/layout.tsx'
cat > 'app/portal/layout.tsx' <<'GE_EOF_0664A5C2'
import type { Metadata } from 'next'
import { HIDE_CONSUMER_CHROME_CSS } from '@/lib/surface'

export const metadata: Metadata = {
  title: { default: 'Masjid Portal · Green Emblem', template: '%s · Masjid Portal' },
  description: 'Post events, fundraisers, programs and youth announcements to your community.',
  robots: { index: false, follow: false },   // the portal is not for search engines
}

// The portal is a separate product surface: no consumer nav, no bottom tab
// bar, no install prompt. Those are mounted in the ROOT layout, which this
// nested layout cannot reach, so suppression happens twice over:
//
//   1. This stylesheet, server-rendered, hides them before the first paint.
//      Needed because portal pages are statically rendered and so cannot
//      read the request hostname on the server.
//   2. The components themselves unmount on hydration once they can see
//      window.location (lib/surface.ts) — which also stops the service
//      worker registering and the install banner firing on this host.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0c1f0c]">
      <style dangerouslySetInnerHTML={{ __html: HIDE_CONSUMER_CHROME_CSS }} />
      {children}
    </div>
  )
}
GE_EOF_0664A5C2

echo "  writing app/portal/page.tsx"
save 'app/portal/page.tsx'
cat > 'app/portal/page.tsx' <<'GE_EOF_8991C6B0'
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Users, Megaphone, Plus, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  event: 'Event', fundraiser: 'Fundraiser', program: 'Program', youth: 'Youth',
}

export default function PortalHome() {
  const { loading, membership } = usePortalSession()
  const supabase = createClient()
  const [posts, setPosts] = useState<any[]>([])
  const [followers, setFollowers] = useState<number | null>(null)

  useEffect(() => {
    if (!membership) return
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/portal/posts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json().catch(() => ({}))
      setPosts(j.posts || [])

      const { count } = await supabase
        .from('profiles').select('id', { count: 'exact', head: true })
        .eq('followed_masjid_id', membership.masjidId)
      setFollowers(count ?? 0)
    })()
  }, [membership]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PortalLoading />

  const now = Date.now()
  const upcoming = posts.filter(p => p.starts_at && new Date(p.starts_at).getTime() > now)
  const totalGoing = posts.reduce((s, p) => s + (p.going || 0), 0)

  const stats = [
    { label: 'Followers', value: followers ?? '—', Icon: Users,
      hint: 'People who get your posts as notifications' },
    { label: 'Upcoming', value: upcoming.length, Icon: CalendarDays,
      hint: 'Events and programs still ahead' },
    { label: 'Attending', value: totalGoing, Icon: Megaphone,
      hint: 'Total RSVPs across your posts' },
  ]

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[980px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-1 font-cinzel text-[24px] font-medium text-white">Overview</h1>
            <p className="font-cormorant text-[15px] italic text-white/45">
              Everything your community sees, in one place.
            </p>
          </div>
          <Button asChild variant="brand">
            <Link href="/portal/posts/new"><Plus className="h-4 w-4" />New post</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {stats.map(({ label, value, Icon, hint }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-[#0a1a0a] p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</span>
                <Icon className="h-4 w-4 text-gold/70" strokeWidth={1.7} />
              </div>
              <div className="font-cinzel text-[30px] leading-none text-white">{value}</div>
              <div className="mt-2 font-cormorant text-[13px] italic leading-snug text-white/35">{hint}</div>
            </div>
          ))}
        </div>

        {/* Recent posts */}
        <div className="rounded-xl border border-white/10 bg-[#0a1a0a]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <h2 className="font-cinzel text-[13px] tracking-wide text-white">Recent posts</h2>
            <Link href="/portal/posts" className="flex items-center gap-1 text-[12px] text-white/50 no-underline hover:text-white">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {posts.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="mb-5 font-cormorant text-[15px] italic leading-relaxed text-white/45">
                Nothing posted yet. Your first event will reach everyone following your masjid.
              </p>
              <Button asChild variant="outline"><Link href="/portal/posts/new">Create your first post</Link></Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {posts.slice(0, 6).map(p => (
                <Link
                  key={p.id}
                  href={`/portal/posts/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 no-underline transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] text-white">{p.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-white/35">
                      <span className="text-gold/70">{TYPE_LABEL[p.type]}</span>
                      {p.starts_at && (
                        <>·<span>{new Date(p.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></>
                      )}
                      {p.status === 'draft' && <><span>·</span><span className="text-white/50">Draft</span></>}
                    </div>
                  </div>
                  <div className={cn('shrink-0 text-[12px]', p.going ? 'text-gold' : 'text-white/25')}>
                    {p.rsvp_enabled ? `${p.going || 0} going` : '—'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
GE_EOF_8991C6B0

echo "  writing app/portal/sign-in/page.tsx"
save 'app/portal/sign-in/page.tsx'
cat > 'app/portal/sign-in/page.tsx' <<'GE_EOF_273390B4'
'use client'
import { useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function PortalSignIn() {
  return <Suspense fallback={null}><SignInInner/></Suspense>
}

function SignInInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(
    params.get('denied') ? 'That account doesn’t manage a masjid. Ask Green Emblem for an invitation.' : ''
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) { setError('That email and password don’t match.'); setBusy(false); return }
    router.replace('/portal')
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 text-center">
          <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="mx-auto mb-4 rounded-xl" />
          <div className="mb-1.5 font-cinzel text-[9px] tracking-[0.28em] text-gold">MASJID PORTAL</div>
          <h1 className="font-cinzel text-[22px] font-medium text-white">Sign in</h1>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#0a1a0a] p-6">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Email</label>
          <Input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="username" required className="mb-4"
          />

          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Password</label>
          <Input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" required className="mb-5"
          />

          {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

          <Button type="submit" variant="brand" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center font-cormorant text-[13px] italic leading-relaxed text-white/35">
          Access is by invitation. If your masjid isn’t set up yet, contact Green Emblem.
        </p>
      </div>
    </div>
  )
}
GE_EOF_273390B4

echo "  writing app/portal/invite/[token]/page.tsx"
save 'app/portal/invite/[token]/page.tsx'
cat > 'app/portal/invite/[token]/page.tsx' <<'GE_EOF_CD7D606F'
'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Invite = { email: string; masjidName: string }

const PROBLEMS: Record<string, string> = {
  invalid: 'This invitation link isn’t valid. Ask Green Emblem to send a new one.',
  used: 'This invitation has already been used. Try signing in instead.',
  expired: 'This invitation has expired. Ask Green Emblem for a fresh link.',
  // Distinct on purpose: telling someone their invitation is invalid when
  // the truth is that we couldn't reach the server would send them chasing
  // a replacement link they don't need.
  unavailable: 'We couldn’t check this invitation just now. Refresh the page in a moment — the link is still good.',
}

export default function AcceptInvite({ params }: { params: { token: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [problem, setProblem] = useState('')
  const [loading, setLoading] = useState(true)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Never leave someone on "LOADING…" — if the check can't complete we
    // say so plainly instead of spinning.
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 8000)

    fetch(`/api/portal/invite/accept?token=${encodeURIComponent(params.token)}`, {
      signal: ac.signal,
    })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          // A 5xx is our problem, not a bad link.
          setProblem(PROBLEMS[j.error] || (r.status >= 500 ? PROBLEMS.unavailable : PROBLEMS.invalid))
        } else setInvite(j)
      })
      .catch(() => setProblem(PROBLEMS.unavailable))
      .finally(() => { clearTimeout(timer); setLoading(false) })

    return () => { clearTimeout(timer); ac.abort() }
  }, [params.token])

  const tooShort = password.length > 0 && password.length < 10
  const mismatch = confirm.length > 0 && password !== confirm

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 10 || password !== confirm) return
    setBusy(true); setError('')

    const res = await fetch('/api/portal/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, password }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error || 'Something went wrong.'); setBusy(false); return }

    // Sign them straight in — no second password entry
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: j.email, password })
    if (signInErr) { router.replace('/portal/sign-in'); return }
    router.replace('/portal')
  }

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center font-cinzel text-[11px] tracking-[0.2em] text-white/30">LOADING…</div>
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="mx-auto mb-4 rounded-xl" />
          <div className="mb-1.5 font-cinzel text-[9px] tracking-[0.28em] text-gold">MASJID PORTAL</div>
        </div>

        {problem ? (
          <div className="rounded-xl border border-white/10 bg-[#0a1a0a] p-6 text-center">
            <p className="mb-5 font-cormorant text-[15px] italic leading-relaxed text-white/60">{problem}</p>
            <Button asChild variant="outline" className="w-full"><a href="/portal/sign-in">Go to sign in</a></Button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#0a1a0a] p-6">
            <h1 className="mb-2 font-cinzel text-[20px] font-medium leading-snug text-white">
              Set your password
            </h1>
            <p className="mb-6 font-cormorant text-[14px] italic leading-relaxed text-white/55">
              You&apos;ve been invited to manage <span className="text-gold">{invite?.masjidName}</span>.
              Choose a password for <span className="text-white/80">{invite?.email}</span>.
            </p>

            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Password</label>
            <Input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" required className="mb-1"
            />
            <p className={`mb-4 text-[12px] ${tooShort ? 'text-destructive' : 'text-white/35'}`}>
              At least 10 characters.
            </p>

            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Confirm password</label>
            <Input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" required className="mb-1"
            />
            <p className={`mb-5 text-[12px] ${mismatch ? 'text-destructive' : 'text-transparent'}`}>
              Those don&apos;t match.
            </p>

            {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

            <Button
              type="submit" variant="brand" className="w-full"
              disabled={busy || password.length < 10 || password !== confirm}
            >
              <Check className="h-4 w-4" />
              {busy ? 'Setting up…' : 'Set password and continue'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
GE_EOF_CD7D606F

echo "  writing app/portal/posts/page.tsx"
save 'app/portal/posts/page.tsx'
cat > 'app/portal/posts/page.tsx' <<'GE_EOF_350C17E1'
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'event', label: 'Events' },
  { id: 'youth', label: 'Youth' },
  { id: 'program', label: 'Programs' },
  { id: 'fundraiser', label: 'Fundraisers' },
]

const TYPE_LABEL: Record<string, string> = {
  event: 'Event', fundraiser: 'Fundraiser', program: 'Program', youth: 'Youth',
}

export default function PostsList() {
  const { loading, membership } = usePortalSession()
  const supabase = createClient()
  const [posts, setPosts] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!membership) return
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/portal/posts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json().catch(() => ({}))
      setPosts(j.posts || [])
      setFetched(true)
    })()
  }, [membership]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PortalLoading />

  const shown = filter === 'all' ? posts : posts.filter(p => p.type === filter)

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[980px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-cinzel text-[24px] font-medium text-white">Posts</h1>
          <Button asChild variant="brand">
            <Link href="/portal/posts/new"><Plus className="h-4 w-4" />New post</Link>
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'cursor-pointer rounded-full border px-3.5 py-1.5 text-[12px] transition-colors',
                filter === f.id
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-white/10 bg-transparent text-white/50 hover:text-white'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1a0a]">
          {!fetched ? (
            <div className="px-5 py-12 text-center font-cinzel text-[11px] tracking-[0.2em] text-white/25">LOADING…</div>
          ) : shown.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="mb-5 font-cormorant text-[15px] italic text-white/45">
                {filter === 'all' ? 'Nothing posted yet.' : `No ${FILTERS.find(f => f.id === filter)?.label.toLowerCase()} yet.`}
              </p>
              <Button asChild variant="outline"><Link href="/portal/posts/new">Create one</Link></Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {shown.map(p => (
                <Link
                  key={p.id}
                  href={`/portal/posts/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 no-underline transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] text-white">{p.title}</span>
                      {p.status === 'draft' && (
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">Draft</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-white/35">
                      <span className="text-gold/70">{TYPE_LABEL[p.type]}</span>
                      {p.starts_at && (
                        <>·<span>{new Date(p.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          <span>{new Date(p.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></>
                      )}
                      {p.type === 'program' && p.schedule_text && <>·<span>{p.schedule_text}</span></>}
                      {p.type === 'fundraiser' && p.goal_amount && (
                        <>·<span>${Number(p.raised_amount || 0).toLocaleString()} of ${Number(p.goal_amount).toLocaleString()}</span></>
                      )}
                    </div>
                  </div>
                  {p.rsvp_enabled && (
                    <div className={cn('flex shrink-0 items-center gap-1.5 text-[12.5px]', p.going ? 'text-gold' : 'text-white/25')}>
                      <Users className="h-3.5 w-3.5" />
                      {p.going || 0}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
GE_EOF_350C17E1

echo "  writing app/portal/posts/new/page.tsx"
save 'app/portal/posts/new/page.tsx'
cat > 'app/portal/posts/new/page.tsx' <<'GE_EOF_41122941'
'use client'
import PortalShell from '@/components/portal/PortalShell'
import PostForm from '@/components/portal/PostForm'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'

export default function NewPost() {
  const { loading, membership } = usePortalSession()
  if (loading) return <PortalLoading />
  return (
    <PortalShell masjidName={membership?.masjidName}>
      <PostForm />
    </PortalShell>
  )
}
GE_EOF_41122941

echo "  writing app/portal/posts/[id]/page.tsx"
save 'app/portal/posts/[id]/page.tsx'
cat > 'app/portal/posts/[id]/page.tsx' <<'GE_EOF_0FC56478'
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Trash2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import PostForm from '@/components/portal/PostForm'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

export default function EditPost({ params }: { params: { id: string } }) {
  const { loading, membership } = usePortalSession()
  const router = useRouter()
  const supabase = createClient()
  const [post, setPost] = useState<any>(null)
  const [attendees, setAttendees] = useState<any[]>([])
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!membership) return
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/portal/posts/${params.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) { setNotFound(true); return }
      const j = await res.json()
      setPost(j.post)
      setAttendees(j.attendees || [])
    })()
  }, [membership, params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/portal/posts/${params.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    router.push('/portal/posts')
    router.refresh()
  }

  if (loading) return <PortalLoading />

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[720px]">
        <button
          onClick={() => router.push('/portal/posts')}
          className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] text-white/45 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </button>

        {notFound ? (
          <p className="font-cormorant text-[15px] italic text-white/50">That post no longer exists.</p>
        ) : !post ? (
          <div className="font-cinzel text-[11px] tracking-[0.2em] text-white/25">LOADING…</div>
        ) : (
          <>
            <PostForm existing={post} />

            {/* Attendee roster — masjid-only. Nothing here is ever public. */}
            {post.rsvp_enabled && (
              <div className="mt-5 rounded-xl border border-white/10 bg-[#0a1a0a]">
                <div className="flex items-center gap-2 border-b border-white/8 px-5 py-4">
                  <Users className="h-4 w-4 text-gold/70" />
                  <h2 className="font-cinzel text-[13px] text-white">
                    Attending ({attendees.length})
                  </h2>
                </div>
                {attendees.length === 0 ? (
                  <p className="px-5 py-8 text-center font-cormorant text-[14px] italic text-white/35">
                    No RSVPs yet.
                  </p>
                ) : (
                  <div className="max-h-[300px] divide-y divide-white/5 overflow-y-auto">
                    {attendees.map((a, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-2.5">
                        <span className="truncate text-[13.5px] text-white/80">
                          {a.profiles?.full_name || a.profiles?.email || 'Guest'}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-white/30">
                          {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5">
              <Button
                variant="ghost" size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Remove this post
              </Button>
            </div>

            <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove this post?</DialogTitle>
                  <DialogDescription>
                    It disappears from your community&apos;s feed straight away. RSVPs are kept in case
                    you need the headcount.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>Keep it</Button>
                  <Button variant="destructive" onClick={remove} disabled={deleting}>
                    {deleting ? 'Removing…' : 'Remove'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </PortalShell>
  )
}
GE_EOF_0FC56478

echo "  writing app/portal/profile/page.tsx"
save 'app/portal/profile/page.tsx'
cat > 'app/portal/profile/page.tsx' <<'GE_EOF_C6A5365D'
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const field = 'mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45'
const textarea =
  'w-full rounded-md border border-gold/20 bg-white/[0.04] px-3.5 py-3 font-cormorant text-[15px] text-white outline-none transition-colors placeholder:italic placeholder:text-white/30 focus:border-gold/50'

export default function MasjidProfile() {
  const { loading, membership } = usePortalSession()
  const supabase = createClient()
  const [form, setForm] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!membership) return
    ;(async () => {
      const { data } = await supabase
        .from('masjids')
        .select('name, description, address, city, state, zip, phone, website, contact_email, instagram_handle, facebook_page, jumuah_times, office_hours, donation_url')
        .eq('id', membership.masjidId).maybeSingle()
      setForm(data || {})
    })()
  }, [membership]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!membership) return
    setBusy(true); setMsg('')
    const { error } = await supabase.from('masjids').update({
      description: form.description || null,
      phone: form.phone || null,
      website: form.website || null,
      contact_email: form.contact_email || null,
      instagram_handle: form.instagram_handle || null,
      facebook_page: form.facebook_page || null,
      jumuah_times: form.jumuah_times || null,
      office_hours: form.office_hours || null,
      donation_url: form.donation_url || null,
    }).eq('id', membership.masjidId)
    setBusy(false)
    setMsg(error ? 'Could not save — try again.' : 'Saved.')
  }

  if (loading) return <PortalLoading />

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[720px]">
        <h1 className="mb-1 font-cinzel text-[24px] font-medium text-white">Masjid</h1>
        <p className="mb-7 font-cormorant text-[15px] italic text-white/45">
          What people see on your public page.
        </p>

        {!form ? (
          <div className="font-cinzel text-[11px] tracking-[0.2em] text-white/25">LOADING…</div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#0a1a0a] p-5 sm:p-6">
            <label className={field}>Name</label>
            <Input value={form.name || ''} disabled className="mb-1 opacity-60" />
            <p className="mb-5 font-cormorant text-[12.5px] italic text-white/30">
              Contact Green Emblem to change the name or address.
            </p>

            <label className={field}>About</label>
            <textarea
              value={form.description || ''} onChange={e => set('description', e.target.value)}
              rows={4} maxLength={1200} className={`${textarea} mb-5`}
              placeholder="A sentence or two about your masjid, its history, and who it serves."
            />

            <label className={field}>Jumu&apos;ah times</label>
            <Input
              value={form.jumuah_times || ''} onChange={e => set('jumuah_times', e.target.value)}
              placeholder="1st khutbah 1:15pm · 2nd khutbah 2:15pm" className="mb-5"
            />

            <label className={field}>Office hours</label>
            <Input
              value={form.office_hours || ''} onChange={e => set('office_hours', e.target.value)}
              placeholder="Mon–Fri, 10am – 6pm" className="mb-5"
            />

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Phone</label>
                <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className={field}>Contact email</label>
                <Input type="email" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} />
              </div>
            </div>

            <label className={field}>Website</label>
            <Input
              type="url" value={form.website || ''} onChange={e => set('website', e.target.value)}
              placeholder="https://…" className="mb-5"
            />

            <label className={field}>Donation page</label>
            <Input
              type="url" value={form.donation_url || ''} onChange={e => set('donation_url', e.target.value)}
              placeholder="https://launchgood.com/…" className="mb-1"
            />
            <p className="mb-5 font-cormorant text-[12.5px] italic text-white/30">
              Where your fundraiser buttons send people. Money goes directly to you.
            </p>

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Instagram</label>
                <Input value={form.instagram_handle || ''} onChange={e => set('instagram_handle', e.target.value)} placeholder="@yourmasjid" />
              </div>
              <div>
                <label className={field}>Facebook</label>
                <Input value={form.facebook_page || ''} onChange={e => set('facebook_page', e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-white/8 pt-5">
              <Button variant="brand" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
              {msg && <span className="font-cormorant text-[13.5px] italic text-white/50">{msg}</span>}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  )
}
GE_EOF_C6A5365D

echo "  writing components/portal/PortalShell.tsx"
save 'components/portal/PortalShell.tsx'
cat > 'components/portal/PortalShell.tsx' <<'GE_EOF_31111FF5'
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Building2, LogOut, Menu, X, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/portal',         label: 'Overview', Icon: LayoutDashboard, exact: true },
  { href: '/portal/posts',   label: 'Posts',    Icon: CalendarDays },
  { href: '/portal/profile', label: 'Masjid',   Icon: Building2 },
]

export default function PortalShell({
  masjidName, children,
}: { masjidName?: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/portal/sign-in')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname?.startsWith(href)

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, Icon, exact }) => {
        const active = isActive(href, exact)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] no-underline transition-colors',
              active ? 'bg-gold/12 text-gold' : 'text-white/60 hover:bg-white/5 hover:text-white'
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-[100dvh]">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/8 bg-[#0a1a0a] lg:flex">
        <div className="border-b border-white/8 px-5 py-5">
          <Link href="/portal" className="flex items-center gap-2.5 no-underline">
            <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="font-cinzel text-[11px] tracking-[0.18em] text-cream">GREEN EMBLEM</span>
          </Link>
          <div className="mt-3 font-cinzel text-[9px] tracking-[0.2em] text-gold/70">MASJID PORTAL</div>
        </div>

        {masjidName && (
          <div className="border-b border-white/8 px-5 py-4">
            <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-white/35">Managing</div>
            <div className="truncate font-cinzel text-[14px] text-white">{masjidName}</div>
          </div>
        )}

        <div className="flex-1 px-3 py-4">{navList}</div>

        <div className="border-t border-white/8 p-3">
          <a
            href="https://green-emblem.com/greenworld-plus"
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-white/45 no-underline transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.7} />
            View public page
          </a>
          <button
            onClick={signOut}
            className="flex w-full cursor-pointer items-center gap-3 rounded-md border-none bg-transparent px-3 py-2.5 text-left text-[13px] text-white/45 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-white/8 bg-[#0a1a0a] px-4 lg:hidden">
          <div className="flex items-center gap-2.5">
            <Image src="/icons/icon-192.png" alt="" width={24} height={24} className="rounded" />
            <span className="font-cinzel text-[10px] tracking-[0.16em] text-gold">MASJID PORTAL</span>
          </div>
          <button
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent text-white/70"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {open && (
          <div className="border-b border-white/8 bg-[#0a1a0a] px-3 py-3 lg:hidden">
            {masjidName && (
              <div className="mb-2 px-3 font-cinzel text-[13px] text-white">{masjidName}</div>
            )}
            {navList}
            <button
              onClick={signOut}
              className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-md border-none bg-transparent px-3 py-2.5 text-left text-[13px] text-white/45"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} />
              Sign out
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  )
}
GE_EOF_31111FF5

echo "  writing components/portal/PortalGuard.tsx"
save 'components/portal/PortalGuard.tsx'
cat > 'components/portal/PortalGuard.tsx' <<'GE_EOF_C01E254D'
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type Membership = { masjidId: string; masjidName: string; role: string }

// Client-side gate for every portal page. Anyone without a masjid membership
// is bounced to sign-in — including signed-in consumer users who happen to
// land on the portal hostname.
export function usePortalSession() {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<{ loading: boolean; membership: Membership | null }>({
    loading: true, membership: null,
  })

  useEffect(() => {
    let cancelled = false

    // A gate that hangs is a gate that's open. If auth or the membership
    // check can't answer — network down, Supabase unreachable, a malformed
    // response — we fail CLOSED and send them to sign-in rather than
    // leaving them on a portal page forever showing "LOADING…".
    const timer = setTimeout(() => {
      if (!cancelled) router.replace('/portal/sign-in?retry=1')
    }, 8000)

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!session) { router.replace('/portal/sign-in'); return }

        const res = await fetch('/api/portal/posts', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (cancelled) return
        if (res.status === 401 || res.status === 403) {
          router.replace('/portal/sign-in?denied=1'); return
        }
        if (!res.ok) { router.replace('/portal/sign-in?retry=1'); return }

        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        setState({
          loading: false,
          membership: json.masjid
            ? { masjidId: json.masjid.id, masjidName: json.masjid.name, role: 'owner' }
            : null,
        })
      } catch {
        if (!cancelled) router.replace('/portal/sign-in?retry=1')
      } finally {
        clearTimeout(timer)
      }
    })()

    return () => { cancelled = true; clearTimeout(timer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

export function PortalLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="font-cinzel text-[11px] tracking-[0.2em] text-white/30">LOADING…</div>
    </div>
  )
}
GE_EOF_C01E254D

echo "  writing components/portal/PostForm.tsx"
save 'components/portal/PostForm.tsx'
cat > 'components/portal/PostForm.tsx' <<'GE_EOF_215187A0'
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, HeartHandshake, Repeat, Sparkles, Send, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type PostType = 'event' | 'fundraiser' | 'program' | 'youth'

const TYPES: { id: PostType; label: string; hint: string; Icon: any }[] = [
  { id: 'event',      label: 'Event',      hint: 'A one-off gathering with a date and time',       Icon: CalendarDays },
  { id: 'youth',      label: 'Youth',      hint: 'For the youth — same as an event, filtered apart', Icon: Sparkles },
  { id: 'program',    label: 'Program',    hint: 'Something recurring, like a weekly halaqa',       Icon: Repeat },
  { id: 'fundraiser', label: 'Fundraiser', hint: 'A goal, and a link to your own donation page',    Icon: HeartHandshake },
]

const field = 'mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45'
const textarea =
  'w-full rounded-md border border-gold/20 bg-white/[0.04] px-3.5 py-3 font-cormorant text-[15px] text-white outline-none transition-colors placeholder:italic placeholder:text-white/30 focus:border-gold/50'

// Datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time. Slicing an ISO
// string would silently shift everything by the UTC offset.
function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PostForm({ existing }: { existing?: any }) {
  const router = useRouter()
  const supabase = createClient()
  const editing = !!existing

  const [type, setType] = useState<PostType>(existing?.type || 'event')
  const [title, setTitle] = useState<string>(existing?.title || '')
  const [body, setBody] = useState<string>(existing?.body || '')
  const [startsAt, setStartsAt] = useState(toLocalInput(existing?.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInput(existing?.ends_at))
  const [location, setLocation] = useState<string>(existing?.location || '')
  const [rsvpEnabled, setRsvpEnabled] = useState<boolean>(existing?.rsvp_enabled ?? true)
  const [scheduleText, setScheduleText] = useState<string>(existing?.schedule_text || '')
  const [goal, setGoal] = useState<string | number>(existing?.goal_amount ?? '')
  const [raised, setRaised] = useState<string | number>(existing?.raised_amount ?? '')
  const [donateUrl, setDonateUrl] = useState<string>(existing?.donate_url || '')
  const [deadline, setDeadline] = useState<string>(existing?.deadline || '')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isDated = type === 'event' || type === 'youth'

  const save = async (status: 'published' | 'draft') => {
    setError('')
    if (!title.trim()) { setError('Give the post a title.'); return }
    if (isDated && !startsAt) { setError('Events need a start date and time.'); return }
    if (type === 'fundraiser' && donateUrl && !/^https?:\/\//i.test(donateUrl)) {
      setError('The donation link needs to start with http:// or https://'); return
    }
    setBusy(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Your session expired — sign in again.'); setBusy(false); return }

    const payload: Record<string, any> = {
      type, title, body: body || null, status,
      starts_at: isDated && startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: isDated && endsAt ? new Date(endsAt).toISOString() : null,
      location: isDated ? location || null : null,
      rsvp_enabled: isDated ? rsvpEnabled : false,
      schedule_text: type === 'program' ? scheduleText || null : null,
      goal_amount: type === 'fundraiser' && goal !== '' ? Number(goal) : null,
      raised_amount: type === 'fundraiser' && raised !== '' ? Number(raised) : 0,
      donate_url: type === 'fundraiser' ? donateUrl || null : null,
      deadline: type === 'fundraiser' && deadline ? deadline : null,
    }

    const res = await fetch(
      editing ? `/api/portal/posts/${existing.id}` : '/api/portal/posts',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      }
    )
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error || 'Could not save.'); return }
    router.push('/portal/posts')
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="mb-1 font-cinzel text-[24px] font-medium text-white">
        {editing ? 'Edit post' : 'New post'}
      </h1>
      <p className="mb-7 font-cormorant text-[15px] italic text-white/45">
        {editing
          ? 'Changes go live as soon as you save.'
          : 'Publishing notifies everyone following your masjid.'}
      </p>

      {/* Type picker — locked once created, since the shape changes */}
      {!editing && (
        <div className="mb-7">
          <label className={field}>What is it?</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map(({ id, label, hint, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-left transition-colors',
                  type === id
                    ? 'border-gold/50 bg-gold/[0.08]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                )}
              >
                <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', type === id ? 'text-gold' : 'text-white/40')} strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className={cn('block font-cinzel text-[13px]', type === id ? 'text-white' : 'text-white/70')}>{label}</span>
                  <span className="block font-cormorant text-[12.5px] italic leading-snug text-white/35">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0a1a0a] p-5 sm:p-6">
        <label className={field}>Title</label>
        <Input
          value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
          placeholder={type === 'fundraiser' ? 'Masjid expansion fund' : 'Friday night halaqa'}
          className="mb-5"
        />

        <label className={field}>Details</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={5000}
          placeholder="What should people know? Who is it for, what to bring, anything else."
          className={cn(textarea, 'mb-5')}
        />

        {isDated && (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Starts</label>
                <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              </div>
              <div>
                <label className={field}>Ends <span className="normal-case text-white/25">(optional)</span></label>
                <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
              </div>
            </div>

            <label className={field}>Location <span className="normal-case text-white/25">(optional)</span></label>
            <Input
              value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Main prayer hall · or an address if it's elsewhere"
              className="mb-5"
            />

            <button
              type="button"
              onClick={() => setRsvpEnabled(v => !v)}
              className="mb-1 flex w-full cursor-pointer items-start gap-3 rounded-lg border-none bg-transparent px-0 py-2 text-left"
            >
              <span className={cn(
                'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                rsvpEnabled ? 'bg-gold' : 'bg-white/15'
              )}>
                <span className={cn('h-4 w-4 rounded-full bg-[#0a1a0a] transition-transform', rsvpEnabled && 'translate-x-4')} />
              </span>
              <span>
                <span className="block text-[13px] text-white">Let people RSVP</span>
                <span className="block font-cormorant text-[12.5px] italic leading-snug text-white/35">
                  They tap “Going” and you see the headcount. There is no “not going” — we don’t ask people to announce that.
                </span>
              </span>
            </button>
          </>
        )}

        {type === 'program' && (
          <>
            <label className={field}>When does it run?</label>
            <Input
              value={scheduleText} onChange={e => setScheduleText(e.target.value)}
              placeholder="Every Saturday, 11am – 1pm"
              className="mb-1"
            />
            <p className="mb-5 font-cormorant text-[12.5px] italic text-white/30">
              Written in plain words — it shows exactly as you type it.
            </p>
          </>
        )}

        {type === 'fundraiser' && (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Goal ($)</label>
                <Input type="number" min="0" step="1" value={goal} onChange={e => setGoal(e.target.value)} placeholder="50000" />
              </div>
              <div>
                <label className={field}>Raised so far ($)</label>
                <Input type="number" min="0" step="1" value={raised} onChange={e => setRaised(e.target.value)} placeholder="12400" />
              </div>
            </div>

            <label className={field}>Donation link</label>
            <Input
              type="url" value={donateUrl} onChange={e => setDonateUrl(e.target.value)}
              placeholder="https://launchgood.com/your-campaign"
              className="mb-1"
            />
            <p className="mb-5 font-cormorant text-[12.5px] italic leading-relaxed text-white/30">
              Donations go straight to your own page — Green Emblem never handles the money,
              and takes nothing. Update the raised amount here whenever you like.
            </p>

            <label className={field}>Deadline <span className="normal-case text-white/25">(optional)</span></label>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="mb-5" />
          </>
        )}

        {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

        <div className="flex flex-col gap-2 border-t border-white/8 pt-5 sm:flex-row">
          <Button variant="brand" onClick={() => save('published')} disabled={busy} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish'}
          </Button>
          {!editing && (
            <Button variant="outline" onClick={() => save('draft')} disabled={busy} className="w-full sm:w-auto">
              <Save className="h-4 w-4" />
              Save as draft
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.back()} disabled={busy} className="w-full text-white/50 sm:ml-auto sm:w-auto">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
GE_EOF_215187A0

echo "  writing components/RsvpButton.tsx"
save 'components/RsvpButton.tsx'
cat > 'components/RsvpButton.tsx' <<'GE_EOF_4E864D0C'
'use client'
import { useEffect, useState } from 'react'
import { Check, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── "Going" only ─────────────────────────────────────────────────────────
// There is no "can't make it" button anywhere in this component, and the
// API has no state for it. Tapping again withdraws — people's plans change,
// and without that the headcount inflates until it's useless to the masjid.
// What we never do is ask someone to announce that they're not coming, or
// show a tally of absences.

export default function RsvpButton({
  postId, initialCount = 0, size = 'default',
}: {
  postId: string
  initialCount?: number
  size?: 'default' | 'sm'
}) {
  const supabase = createClient()
  const [going, setGoing] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/posts/${postId}/rsvp`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (cancelled || !res.ok) { setReady(true); return }
      const j = await res.json()
      setGoing(!!j.going)
      setCount(j.count ?? 0)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    setBusy(true); setNote('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setBusy(false)
      setNote('Sign in to let them know you’re coming.')
      return
    }

    // Optimistic — the network round trip shouldn't make the tap feel slow
    const wasGoing = going
    setGoing(!wasGoing)
    setCount(c => Math.max(0, c + (wasGoing ? -1 : 1)))

    const res = await fetch(`/api/posts/${postId}/rsvp`, {
      method: wasGoing ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      setGoing(wasGoing)                                   // roll back
      setCount(c => Math.max(0, c + (wasGoing ? 1 : -1)))
      const j = await res.json().catch(() => ({}))
      setNote(j.error || 'Could not update your RSVP.')
    } else {
      const j = await res.json()
      setGoing(j.going)
      setCount(j.count ?? 0)
    }
    setBusy(false)
  }

  if (!ready) return null

  const compact = size === 'sm'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={going}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-lg border font-cinzel tracking-wider2 transition-all',
          compact ? 'px-3.5 py-2 text-[10px]' : 'px-5 py-2.5 text-[11px]',
          going
            ? 'border-forest-mid bg-forest-mid/20 text-forest-light'
            : 'border-gold bg-gold text-forest-deepest hover:opacity-90'
        )}
      >
        {going ? <Check className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
        {going ? "You're going" : 'Going'}
      </button>

      {count > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-white/50">
          <Users className="h-3.5 w-3.5 text-gold/70" />
          {count} {count === 1 ? 'person' : 'people'} going
        </span>
      )}

      {note && <span className="font-cormorant text-[13px] italic text-white/45">{note}</span>}
    </div>
  )
}
GE_EOF_4E864D0C

echo "  writing components/BottomNav.tsx"
save 'components/BottomNav.tsx'
cat > 'components/BottomNav.tsx' <<'GE_EOF_B6932247'
'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Home, Compass, HeartHandshake, LayoutGrid, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isConsumerSurface } from '@/lib/surface'

// ── Mobile bottom tab bar ────────────────────────────────────────────────
// Pocket-check features one thumb-tap away. Hidden on desktop, and on the
// admin console and masjid portal — those are their own surfaces and this
// bar would sit over their content.
const TABS = [
  { href: '/',          label: 'Home',    Icon: Home },
  { href: '/prayer',    label: 'Prayer',  Icon: Compass },
  { href: '/sadaqah',   label: 'Give',    Icon: HeartHandshake },
  { href: '/explore',   label: 'Explore', Icon: LayoutGrid },
  { href: '/dashboard', label: 'Profile', Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  // The hostname is only knowable in the browser, so this starts as the
  // server's answer and corrects itself on mount. On the portal the CSS in
  // its layout has already hidden the bar, so nothing flashes in between.
  const [host, setHost] = useState<string | null>(null)
  useEffect(() => { setHost(window.location.hostname) }, [])

  if (!isConsumerSurface(pathname, host)) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[120] border-t border-gold/15 bg-forest-deepest/95 backdrop-blur-xl lg:hidden',
          'pb-[env(safe-area-inset-bottom,0px)]'
        )}
      >
        <div className="mx-auto flex h-[62px] max-w-[520px] items-stretch justify-around">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-[3px] no-underline"
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-6 rounded-full bg-gold" />
                )}
                <Icon
                  className={cn('h-[22px] w-[22px] transition-colors', active ? 'text-gold' : 'text-white/60')}
                  strokeWidth={active ? 2 : 1.6}
                />
                <span
                  className={cn(
                    'text-[9px] font-semibold tracking-wide transition-colors',
                    active ? 'text-white' : 'text-white/60'
                  )}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Keep page content clear of the bar on mobile */}
      <style>{`
        @media (max-width: 1023px) {
          body { padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </>
  )
}
GE_EOF_B6932247

echo "  writing components/PWARegister.tsx"
save 'components/PWARegister.tsx'
cat > 'components/PWARegister.tsx' <<'GE_EOF_D9BE3596'
'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isConsumerSurface } from '@/lib/surface'

// Registers the service worker once, on every page. Silent by design —
// a failed registration should never surface to the user.
//
// Not on the portal: it is served from its own hostname, so registering
// there would create a second, separate service worker that handles no
// push and caches staff pages nobody wants cached.
export default function PWARegister() {
  const pathname = usePathname()
  useEffect(() => {
    // Runs in the browser only, so window.location is the reliable check.
    if (!isConsumerSurface(pathname, window.location.hostname)) return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'development') return   // avoid stale SW during dev

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
    // Wait for load so the SW never competes with first paint for bandwidth
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [pathname])

  return null
}
GE_EOF_D9BE3596

echo "  writing components/InstallPrompt.tsx"
save 'components/InstallPrompt.tsx'
cat > 'components/InstallPrompt.tsx' <<'GE_EOF_ADFFA775'
'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, X, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isIos, isStandalone } from '@/lib/push-client'
import { isConsumerSurface } from '@/lib/surface'

const DISMISS_KEY = 'ge_install_dismissed_at'
const DISMISS_DAYS = 30

// A quiet, dismissible invitation to install. Appears only after the visitor
// has actually used the site (30s), and stays gone for a month once
// dismissed — an install banner that nags is worse than none.
export default function InstallPrompt() {
  const pathname = usePathname()
  const [host, setHost] = useState<string | null>(null)
  useEffect(() => { setHost(window.location.hostname) }, [])
  const consumer = isConsumerSurface(pathname, host)
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    // The admin console and the masjid portal are staff surfaces — nobody
    // there should be asked to install the consumer app.
    if (!consumer) return
    if (isStandalone()) return
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
      if (at && Date.now() - at < DISMISS_DAYS * 86400000) return
    } catch {}

    // Android / desktop Chrome
    const onPrompt = (e: any) => {
      e.preventDefault()
      setDeferred(e)
      setTimeout(() => setShow(true), 30000)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS never fires that event — it needs manual Share → Add to Home Screen
    if (isIos()) {
      setIosHint(true)
      const t = setTimeout(() => setShow(true), 30000)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt) }
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [consumer])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setDeferred(null)
    dismiss()
  }

  if (!consumer || !show) return null

  return (
    <div
      role="dialog"
      aria-label="Install Green Emblem"
      data-consumer-chrome=""
      className="fixed inset-x-3 bottom-[calc(74px+env(safe-area-inset-bottom,0px))] z-[130] rounded-xl border border-gold/25 bg-forest-deepest/97 p-4 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-[360px]"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center border-none bg-transparent text-white/40 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-2 font-cinzel text-[10px] tracking-[0.2em] text-gold">ADD TO HOME SCREEN</div>
      <p className="mb-3.5 pr-6 font-cormorant text-[15px] italic leading-relaxed text-white/70">
        {iosHint
          ? 'Tap Share, then “Add to Home Screen” — that also lets Green Emblem send you prayer reminders.'
          : 'Open prayer times in one tap, and get reminders when a prayer comes in.'}
      </p>

      {iosHint ? (
        <div className="flex items-center gap-2 font-cinzel text-[10px] tracking-[0.12em] text-white/60">
          <Share className="h-4 w-4 text-gold" />
          Share → Add to Home Screen
        </div>
      ) : (
        <Button variant="brand" size="sm" className="w-full" onClick={install}>
          <Download className="h-4 w-4" />
          Install
        </Button>
      )}
    </div>
  )
}
GE_EOF_ADFFA775

echo "  writing app/greenworld-plus/page.tsx"
save 'app/greenworld-plus/page.tsx'
cat > 'app/greenworld-plus/page.tsx' <<'GE_EOF_0C8401CA'
'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { ExploreNearbyMap } from '@/components/MosqueMap'
import RsvpButton from '@/components/RsvpButton'

type Masjid = { id: string; name: string; city: string; state: string; verified: boolean }
type EventRow = {
  id: string; title: string; description: string | null; event_start: string; event_end: string
  masjid_id?: string
  masjids: { name: string; city: string; state: string; lat: number | null; lng: number | null } | null
}

export default function GreenWorldPlusPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [checked, setChecked] = useState(false)

  const [masjids, setMasjids] = useState<Masjid[]>([])
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [posts, setPosts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        setProfile(p)
      }
      setChecked(true)
    })
    fetch('/api/masjid-events').then(r => r.json()).then(d => { setEvents(d.events || []); setLoadingEvents(false) }).catch(() => setLoadingEvents(false))

    // Posts published from the masjid portal
    supabase
      .from('masjid_posts')
      .select('*, masjids(name, city, state)')
      .eq('status', 'published')
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(30)
      .then(({ data }: any) => setPosts(data || []))

  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/masjids${search ? `?q=${encodeURIComponent(search)}` : ''}`)
        .then(r => r.json()).then(d => setMasjids(d.masjids || []))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const followMasjid = async (masjidId: string | null) => {
    if (!user) { window.location.href = '/auth/sign-in'; return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ followed_masjid_id: masjidId, sub_greenworld_plus: true }),
      })
      const data = await res.json()
      if (data.profile) setProfile(data.profile)
    }
    setSaving(false)
  }

  const saveTravelRadius = async (mi: number) => {
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ travel_radius_miles: mi }),
    }).catch(() => {})
  }

  const followedMasjid = masjids.find(m => m.id === profile?.followed_masjid_id)
  const displayedEvents = events

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '760px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: '#9b8ec4', marginBottom: '16px' }}>GREENWORLD+</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Local events, all in one place</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Follow your masjid to get notified the moment they post something new.
          </p>
        </div>

        {/* Follow a masjid */}
        <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(155,142,196,0.2)', borderRadius: '16px', padding: '22px', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#9b8ec4', marginBottom: '14px' }}>YOUR MASJID</div>

          {followedMasjid ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff' }}>{followedMasjid.name}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{followedMasjid.city}, {followedMasjid.state}</div>
              </div>
              <button onClick={() => followMasjid(null)} disabled={saving} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'none', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer' }}>Unfollow</button>
            </div>
          ) : (
            <>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search verified Sunni masjids and Islamic institutes…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(155,142,196,0.3)', borderRadius: '9px', padding: '11px 13px', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', outline: 'none', marginBottom: masjids.length ? '10px' : 0 }}
              />
              {masjids.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {masjids.map(m => (
                    <button key={m.id} onClick={() => followMasjid(m.id)} disabled={saving} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                      <span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff' }}>{m.name}</span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>{m.city}, {m.state}</span>
                      </span>
                      <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#9b8ec4' }}>Follow +</span>
                    </button>
                  ))}
                </div>
              )}
              {search && masjids.length === 0 && (
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '8px' }}>No masjids found yet — our directory is growing. Check back soon.</p>
              )}
            </>
          )}
        </div>

        {/* Explore nearby — radius-bounded community map */}
        <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.14)', borderRadius: '16px', padding: '22px', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '6px' }}>EXPLORE NEARBY</div>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: '16px' }}>
            Set how far you&apos;re willing to travel — masjids, halal food, and community events within your boundary.
          </p>
          <ExploreNearbyMap
            initialRadiusMi={profile?.travel_radius_miles}
            events={events}
            onRadiusSave={saveTravelRadius}
          />
        </div>

        {/* From the masjids themselves */}
        {posts.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '14px' }}>
              FROM YOUR MASJIDS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {posts.map(p => (
                <div key={p.id} id={`post-${p.id}`} style={{ background: 'rgba(27,63,27,0.6)', border: '0.5px solid rgba(212,175,110,0.14)', borderRadius: '14px', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
                    <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '16px', color: '#fff' }}>{p.title}</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: '#d4af6e', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                      {p.type === 'youth' ? 'Youth' : p.type}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>
                    {p.masjids?.name}
                    {p.starts_at && ` · ${new Date(p.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${new Date(p.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                    {p.type === 'program' && p.schedule_text && ` · ${p.schedule_text}`}
                  </div>
                  {p.body && (
                    <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '12px' }}>{p.body}</p>
                  )}
                  {p.type === 'fundraiser' && p.goal_amount && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (Number(p.raised_amount || 0) / Number(p.goal_amount)) * 100)}%`, background: '#d4af6e' }}/>
                      </div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                        ${Number(p.raised_amount || 0).toLocaleString()} raised of ${Number(p.goal_amount).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {p.type === 'fundraiser' && p.donate_url && (
                    <a href={p.donate_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.16em', color: '#143314', background: '#d4af6e', padding: '9px 18px', borderRadius: '8px', textDecoration: 'none' }}>
                      Donate
                    </a>
                  )}
                  {p.rsvp_enabled && <RsvpButton postId={p.id} size="sm" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events feed */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', marginBottom: '14px' }}>
          UPCOMING EVENTS
        </div>

        {loadingEvents ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Loading events…</div>
        ) : displayedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 24px', background: 'rgba(15,31,15,0.4)', borderRadius: '14px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
              No events posted yet. As masjids join our directory, their events will show up here — and you'll be notified if you follow them.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayedEvents.map(e => (
              <div key={e.id} style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#fff' }}>{e.title}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: '#9b8ec4', whiteSpace: 'nowrap' }}>{fmtDate(e.event_start)} · {fmtTime(e.event_start)}</div>
                </div>
                {e.masjids?.name && <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>{e.masjids.name} · {e.masjids.city}, {e.masjids.state}</div>}
                {e.description && <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontStyle: 'italic' }}>{e.description}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
GE_EOF_0C8401CA

echo "  writing app/admin/page.tsx"
save 'app/admin/page.tsx'
cat > 'app/admin/page.tsx' <<'GE_EOF_15FB11B7'
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FONT_PAIRS, PATTERNS, OVERLAYS } from '@/lib/campaign-design'
import { MosqueAutocomplete, type MosquePlace } from '@/components/MosqueMap'

const PANELS = ['overview','campaigns','requests','templates','masjids','orders','users','newsletter'] as const
type Panel = typeof PANELS[number]

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('overview')
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  // Data
  const [stats, setStats] = useState({ campaigns:0, activeCampaigns:0, donations:0, totalRaised:0, mealsFunded:0, orders:0, orderRevenue:0, subscribers:0, users:0 })
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [masjids, setMasjids] = useState<any[]>([])
  const [masjidEvents, setMasjidEvents] = useState<any[]>([])
  const [masjidModal, setMasjidModal] = useState(false)
  const [masjidPlace, setMasjidPlace] = useState<MosquePlace | null>(null)
  const [masjidForm, setMasjidForm] = useState({ name:'', instagram_handle:'', facebook_page:'', phone:'', website:'', verified:true, auto_sync_enabled:false })
  const [masjidSaving, setMasjidSaving] = useState(false)
  const [inviteFor, setInviteFor] = useState<any>(null)      // masjid being invited
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResult, setInviteResult] = useState<{link?:string;emailed?:boolean;error?:string}|null>(null)
  const [eventModal, setEventModal] = useState<string | null>(null) // masjid_id
  const [eventForm, setEventForm] = useState({ title:'', description:'', event_start:'', event_end:'' })
  const [eventSaving, setEventSaving] = useState(false)

  // Template editor
  const [tplModal, setTplModal] = useState(false)
  const [tplEdit, setTplEdit] = useState<any>(null)
  const emptyTpl = { name:'', bg:'#0f1f0f', accent:'#d4af6e', text:'#f5f0e6', font_pair:'cinzel', pattern:'star8', overlay:'frame', pattern_opacity:0.07, published:true, sort_order:0 }
  const [tplForm, setTplForm] = useState<any>(emptyTpl)
  const [tplSaving, setTplSaving] = useState(false)

  // Newsletter composer
  const [newsletterSubject, setNewsletterSubject] = useState('')
  const [newsletterBody, setNewsletterBody] = useState('')
  const [sendingNewsletter, setSendingNewsletter] = useState(false)
  const [newsletterSent, setNewsletterSent] = useState(false)

  // Product modal
  const [productModal, setProductModal] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [pForm, setPForm] = useState({ name:'', category:'shop', price:'', description:'', visibility:'draft' })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
      setAuthorized(true)
      await loadAll()
      setLoading(false)
    })
  }, [])

  const loadAll = async () => {
    const [campaignsRes, requestsRes, ordersRes, usersRes, subscribersRes, donationsRes, templatesRes, masjidsRes, masjidEventsRes] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('*').eq('is_active', true).order('subscribed_at', { ascending: false }),
      supabase.from('donations').select('amount,meals_funded,confirmed').eq('confirmed', true),
      supabase.from('campaign_templates').select('*').order('sort_order', { ascending: true }),
      supabase.from('masjids').select('*').eq('active', true).order('name', { ascending: true }),
      supabase.from('masjid_events').select('*').order('event_start', { ascending: false }),
    ])

    const camps = campaignsRes.data || []
    const ords = ordersRes.data || []
    const donations = donationsRes.data || []
    const subs = subscribersRes.data || []

    setCampaigns(camps)
    setRequests(requestsRes.data || [])
    setOrders(ords)
    setUsers(usersRes.data || [])
    setSubscribers(subs)
    setTemplates(templatesRes.data || [])
    setMasjids(masjidsRes.data || [])
    setMasjidEvents(masjidEventsRes.data || [])

    setStats({
      campaigns: camps.length,
      activeCampaigns: camps.filter(c => c.status === 'active').length,
      donations: donations.length,
      totalRaised: donations.reduce((s,d) => s + (d.amount||0), 0),
      mealsFunded: donations.reduce((s,d) => s + (d.meals_funded||0), 0),
      orders: ords.length,
      orderRevenue: ords.reduce((s,o) => s + (o.total||0), 0),
      subscribers: subs.length,
      users: (usersRes.data||[]).length,
    })
  }

  const updateCampaignStatus = async (id: string, status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', id)
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, status } : c))
    setStats(s => ({ ...s, activeCampaigns: status === 'active' ? s.activeCampaigns + 1 : s.activeCampaigns - 1 }))
  }

  const sendMagicLink = async (requestId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ request_id: requestId }),
    })
    await supabase.from('campaign_requests').update({ status: 'approved' }).eq('id', requestId)
    setRequests(rs => rs.map(r => r.id === requestId ? { ...r, status: 'approved' } : r))
  }

  const saveMasjid = async () => {
    if (!masjidForm.name) return
    setMasjidSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/masjids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        ...masjidForm,
        address: masjidPlace?.formattedAddress,
        lat: masjidPlace?.lat, lng: masjidPlace?.lng, place_id: masjidPlace?.placeId,
        city: masjidPlace?.formattedAddress?.split(',')[1]?.trim(),
        state: masjidPlace?.formattedAddress?.split(',')[2]?.trim()?.split(' ')[0],
      }),
    })
    const data = await res.json()
    if (data.masjid) setMasjids(ms => [...ms, data.masjid].sort((a,b) => a.name.localeCompare(b.name)))
    setMasjidSaving(false)
    setMasjidModal(false)
    setMasjidForm({ name:'', instagram_handle:'', facebook_page:'', phone:'', website:'', verified:true, auto_sync_enabled:false })
    setMasjidPlace(null)
  }

  const sendPortalInvite = async () => {
    if (!inviteFor || !inviteEmail) return
    setInviteBusy(true); setInviteResult(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/portal/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ masjid_id: inviteFor.id, email: inviteEmail }),
    })
    const j = await res.json().catch(() => ({}))
    setInviteBusy(false)
    setInviteResult(res.ok ? { link: j.link, emailed: j.emailed } : { error: j.error || 'Could not send the invitation.' })
  }

  const deleteMasjid = async (id: string) => {
    if (!confirm('Remove this masjid from the directory?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/masjids/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    setMasjids(ms => ms.filter(m => m.id !== id))
  }

  const saveEvent = async (masjidId: string) => {
    if (!eventForm.title || !eventForm.event_start || !eventForm.event_end) return
    setEventSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/masjid-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ masjid_id: masjidId, ...eventForm }),
    })
    const data = await res.json()
    if (data.event) setMasjidEvents(es => [data.event, ...es])
    setEventSaving(false)
    setEventModal(null)
    setEventForm({ title:'', description:'', event_start:'', event_end:'' })
  }

  const cancelEvent = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/masjid-events/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    setMasjidEvents(es => es.map(e => e.id === id ? { ...e, status: 'cancelled' } : e))
  }

  const approveEvent = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/masjid-events/${id}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    if (res.ok) setMasjidEvents(es => es.map(e => e.id === id ? { ...e, status: 'active' } : e))
  }

  const [syncingMasjid, setSyncingMasjid] = useState<string | null>(null)
  const syncMasjidNow = async (id: string) => {
    setSyncingMasjid(id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/admin/sync-masjid/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    const data = await res.json()
    await loadAll() // refresh masjid sync status + any new pending events
    setSyncingMasjid(null)
    if (data.error) alert(`Sync issue: ${data.error}`)
    else alert(`Sync complete — found ${data.totalExtracted} event(s), ${data.newEvents} new.`)
  }

  const sendNewsletter = async () => {
    if (!newsletterSubject || !newsletterBody) return
    setSendingNewsletter(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ subject: newsletterSubject, body: newsletterBody }),
    })
    setNewsletterSent(true)
    setSendingNewsletter(false)
    setTimeout(() => { setNewsletterSent(false); setNewsletterSubject(''); setNewsletterBody('') }, 3000)
  }


  const openTplModal = (t?: any) => {
    setTplEdit(t || null)
    setTplForm(t ? { name:t.name, bg:t.bg, accent:t.accent, text:t.text, font_pair:t.font_pair, pattern:t.pattern, overlay:t.overlay, pattern_opacity:t.pattern_opacity, published:t.published, sort_order:t.sort_order||0 } : emptyTpl)
    setTplModal(true)
  }

  const saveTemplate = async () => {
    if (!tplForm.name) return
    setTplSaving(true)
    if (tplEdit) {
      const { data } = await supabase.from('campaign_templates').update(tplForm).eq('id', tplEdit.id).select().single()
      if (data) setTemplates(ts => ts.map(t => t.id === tplEdit.id ? data : t))
    } else {
      const { data } = await supabase.from('campaign_templates').insert(tplForm).select().single()
      if (data) setTemplates(ts => [...ts, data])
    }
    setTplSaving(false)
    setTplModal(false)
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? Campaigns already using it are unaffected.')) return
    await supabase.from('campaign_templates').delete().eq('id', id)
    setTemplates(ts => ts.filter(t => t.id !== id))
  }

  const toggleTemplatePublished = async (t: any) => {
    const { data } = await supabase.from('campaign_templates').update({ published: !t.published }).eq('id', t.id).select().single()
    if (data) setTemplates(ts => ts.map(x => x.id === t.id ? data : x))
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const c = {
    page: { minHeight:'100dvh', background:'#080f08', display:'grid', gridTemplateColumns:'220px 1fr' } as React.CSSProperties,
    sidebar: { background:'rgba(15,31,15,0.95)', borderRight:'0.5px solid rgba(212,175,110,0.12)', padding:'0', display:'flex', flexDirection:'column' as const, position:'sticky' as const, top:0, height:'100dvh', overflowY:'auto' as const },
    main: { padding:'32px', overflowY:'auto' as const },
    navItem: (active:boolean) => ({ display:'flex', alignItems:'center', gap:'10px', padding:'10px 18px', cursor:'pointer', background:active?'rgba(212,175,110,0.08)':'transparent', borderLeft:`2px solid ${active?'#d4af6e':'transparent'}`, transition:'all 0.15s', border:'none', width:'100%', textAlign:'left' as const } as React.CSSProperties),
    navLabel: (active:boolean) => ({ fontFamily:'Georgia,serif', fontSize:'11px', letterSpacing:'0.12em', color:active?'#d4af6e':'rgba(255,255,255,0.45)' }),
    card: { background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', padding:'18px' } as React.CSSProperties,
    statCard: { background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', padding:'16px' } as React.CSSProperties,
    th: { fontFamily:'Georgia,serif', fontSize:'9px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.35)', padding:'10px 14px', textAlign:'left' as const, borderBottom:'0.5px solid rgba(212,175,110,0.08)', fontWeight:400 },
    td: { padding:'11px 14px', borderBottom:'0.5px solid rgba(212,175,110,0.05)', fontFamily:'Georgia,serif', fontSize:'13px', color:'rgba(255,255,255,0.75)', verticalAlign:'middle' as const },
    h2: { fontFamily:'Georgia,serif', fontSize:'10px', letterSpacing:'0.24em', color:'#d4af6e', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' } as React.CSSProperties,
    inp: { width:'100%', background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(212,175,110,0.2)', borderRadius:'8px', padding:'10px 13px', fontFamily:'Georgia,serif', fontSize:'14px', color:'#fff', outline:'none' } as React.CSSProperties,
    badge: (color:string) => ({ fontFamily:'Georgia,serif', fontSize:'9px', padding:'2px 9px', borderRadius:'20px', background:`${color}18`, color, border:`0.5px solid ${color}40` }),
    btn: (color:string='gold') => ({ fontFamily:'Georgia,serif', fontSize:'9px', letterSpacing:'0.1em', padding:'6px 13px', borderRadius:'7px', cursor:'pointer', border:'none', background:color==='gold'?'#d4af6e':color==='red'?'rgba(226,75,74,0.15)':'rgba(29,158,117,0.15)', color:color==='gold'?'#0f1f0f':color==='red'?'#e24b4a':'#1D9E75', transition:'all 0.15s' } as React.CSSProperties),
  }

  const sectionTitle = (t:string) => (
    <h2 style={c.h2}>{t}<span style={{flex:1,height:'0.5px',background:'rgba(212,175,110,0.12)',display:'block'}}/></h2>
  )

  if (!authorized && !loading) return <div style={{minHeight:'100dvh',background:'#080f08',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'rgba(255,255,255,0.4)',fontFamily:'Georgia,serif'}}>Access denied.</div></div>
  if (loading) return <div style={{minHeight:'100dvh',background:'#080f08',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'rgba(255,255,255,0.4)',fontFamily:'Georgia,serif',fontStyle:'italic'}}>Loading admin…</div></div>

  const navItems: {id:Panel;label:string;icon:string}[] = [
    {id:'overview',label:'Overview',icon:'◈'},
    {id:'campaigns',label:'Campaigns',icon:'◉'},
    {id:'requests',label:'Sadaqah Requests',icon:'◎'},
    {id:'templates',label:'Design Templates',icon:'▦'},
    {id:'masjids',label:'Masjids & Events',icon:'\u25b3'},
    {id:'orders',label:'Orders',icon:'◐'},
    {id:'users',label:'Users',icon:'◑'},
    {id:'newsletter',label:'Newsletter',icon:'◓'},
  ]

  return (
    <div style={c.page}>
      {/* Sidebar */}
      <aside style={c.sidebar}>
        <div style={{padding:'20px 18px 16px',borderBottom:'0.5px solid rgba(212,175,110,0.1)'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.22em',color:'#d4af6e',marginBottom:'3px'}}>GREEN EMBLEM</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.08em'}}>Admin Console</div>
        </div>
        <nav style={{flex:1,paddingTop:'8px'}}>
          {navItems.map(item => (
            <button key={item.id} style={c.navItem(panel===item.id)} onClick={() => setPanel(item.id)}>
              <span style={{fontSize:'14px',color:panel===item.id?'#d4af6e':'rgba(255,255,255,0.3)'}}>{item.icon}</span>
              <span style={c.navLabel(panel===item.id)}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={{padding:'14px 18px',borderTop:'0.5px solid rgba(212,175,110,0.08)'}}>
          <a href="/" style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.25)',textDecoration:'none'}}>← Back to site</a>
        </div>
      </aside>

      {/* Main content */}
      <main style={c.main}>

        {/* ── OVERVIEW ── */}
        {panel === 'overview' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            {sectionTitle('Overview')}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'12px'}}>
              {[
                {label:'Active campaigns',value:stats.activeCampaigns,color:'#1D9E75'},
                {label:'Total raised',value:`$${stats.totalRaised.toFixed(2)}`,color:'#d4af6e'},
                {label:'Meals funded',value:stats.mealsFunded.toLocaleString(),color:'#E8A020'},
                {label:'Orders',value:stats.orders,color:'#d4af6e'},
                {label:'Order revenue',value:`$${stats.orderRevenue.toFixed(2)}`,color:'#1D9E75'},
                {label:'Newsletter',value:`${stats.subscribers} subs`,color:'#378ADD'},
                {label:'Total users',value:stats.users,color:'rgba(255,255,255,0.6)'},
              ].map(({label,value,color}) => (
                <div key={label} style={c.statCard}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'8px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.3)',marginBottom:'6px'}}>{label}</div>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,3vw,28px)',color,fontWeight:300,lineHeight:1}}>{value}</div>
                </div>
              ))}
            </div>

            {/* Recent campaigns */}
            <div style={c.card}>
              {sectionTitle('Recent campaigns')}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Campaign','Event','Status','Raised','Donors'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.slice(0,5).map(campaign => (
                    <tr key={campaign.id}>
                      <td style={c.td}>{campaign.honoree_names}</td>
                      <td style={{...c.td,color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>{campaign.event_type}</td>
                      <td style={c.td}><span style={c.badge(campaign.status==='active'?'#1D9E75':campaign.status==='ended'?'rgba(255,255,255,0.3)':'#d4a017')}>{campaign.status}</span></td>
                      <td style={{...c.td,color:'#d4af6e'}}>${(campaign.total_raised||0).toFixed(2)}</td>
                      <td style={c.td}>{campaign.donor_count||0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent orders */}
            <div style={c.card}>
              {sectionTitle('Recent orders')}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Order #','Type','Total','Status'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.slice(0,5).map(order => (
                    <tr key={order.id}>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)',letterSpacing:'0.06em'}}>{order.order_number}</td>
                      <td style={c.td}>{order.order_type}</td>
                      <td style={{...c.td,color:'#d4af6e'}}>${order.total?.toFixed(2)}</td>
                      <td style={c.td}><span style={c.badge(order.status==='delivered'?'#1D9E75':'#d4a017')}>{order.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CAMPAIGNS ── */}
        {panel === 'campaigns' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Campaigns (${campaigns.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Campaign','Event','Date','Status','Raised','Donors','Meals','Actions'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.map(camp => (
                    <tr key={camp.id}>
                      <td style={c.td}><a href={`/give/${camp.slug}`} target="_blank" style={{color:'#d4af6e',textDecoration:'none'}}>{camp.honoree_names}</a></td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{camp.event_type}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{camp.event_date||'—'}</td>
                      <td style={c.td}><span style={c.badge(camp.status==='active'?'#1D9E75':camp.status==='ended'?'rgba(255,255,255,0.4)':'#d4a017')}>{camp.status}</span></td>
                      <td style={{...c.td,color:'#d4af6e'}}>${(camp.total_raised||0).toFixed(2)}</td>
                      <td style={c.td}>{camp.donor_count||0}</td>
                      <td style={c.td}>{camp.meals_funded||0}</td>
                      <td style={{...c.td,display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        {camp.status !== 'active' && <button style={c.btn('green')} onClick={() => updateCampaignStatus(camp.id,'active')}>Activate</button>}
                        {camp.status === 'active' && <button style={c.btn('red')} onClick={() => updateCampaignStatus(camp.id,'ended')}>End</button>}
                        <a href={`/api/campaigns/${camp.slug}/qr-card?format=png`} download style={{...c.btn(), textDecoration:'none', display:'inline-block'}}>QR</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SADAQAH REQUESTS ── */}
        {panel === 'requests' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Sadaqah requests (${requests.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Event','Date','Status','Actions'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td style={c.td}>{req.first_name} {req.last_name}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{req.email}</td>
                      <td style={{...c.td,fontSize:'12px'}}>{req.event_type}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)'}}>{req.event_date||'—'}</td>
                      <td style={c.td}><span style={c.badge(req.status==='approved'?'#1D9E75':'#d4a017')}>{req.status}</span></td>
                      <td style={c.td}>
                        <button style={c.btn('gold')} onClick={() => sendMagicLink(req.id)}>
                          Resend builder link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DESIGN TEMPLATES ── */}
        {panel === 'templates' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Design templates (${templates.length})`)}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>
                Published templates appear in the campaign design studio gallery for all users.
              </p>
              <button style={c.btn('gold')} onClick={() => openTplModal()}>+ New template</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:'14px'}}>
              {templates.length === 0 && (
                <div style={{...c.card,gridColumn:'1/-1',textAlign:'center',padding:'40px',color:'rgba(255,255,255,0.3)',fontFamily:'Georgia,serif',fontStyle:'italic'}}>
                  No custom templates yet. The 8 built-in classics always show in the studio — templates you add here appear alongside them.
                </div>
              )}
              {templates.map(t => (
                <div key={t.id} style={{...c.card,padding:0,overflow:'hidden'}}>
                  <div style={{position:'relative',height:'90px',background:t.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'5px'}}>
                    <div style={{width:'46%',height:'6px',borderRadius:'3px',background:t.accent}}/>
                    <div style={{width:'64%',height:'3px',borderRadius:'2px',background:`${t.text}55`}}/>
                    <div style={{width:'30%',height:'9px',borderRadius:'5px',background:t.accent,marginTop:'3px'}}/>
                    {!t.published && <span style={{position:'absolute',top:'7px',right:'7px',...c.badge('#d4a017')}}>draft</span>}
                  </div>
                  <div style={{padding:'12px 14px'}}>
                    <div style={{fontFamily:'Georgia,serif',fontSize:'13px',color:'#fff',marginBottom:'2px'}}>{t.name}</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'10px'}}>{t.font_pair} · {t.pattern} · {t.overlay}</div>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                      <button style={c.btn()} onClick={() => openTplModal(t)}>Edit</button>
                      <button style={c.btn('green')} onClick={() => toggleTemplatePublished(t)}>{t.published ? 'Unpublish' : 'Publish'}</button>
                      <button style={c.btn('red')} onClick={() => deleteTemplate(t.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Editor modal */}
            {tplModal && (
              <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}} onClick={() => setTplModal(false)}>
                <div style={{...c.card,width:'100%',maxWidth:'520px',maxHeight:'86dvh',overflowY:'auto',padding:'24px'}} onClick={e => e.stopPropagation()}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'#d4af6e',marginBottom:'18px'}}>{tplEdit ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'}</div>

                  {/* Live mini preview */}
                  <div style={{position:'relative',height:'110px',background:tplForm.bg,borderRadius:'10px',marginBottom:'18px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'6px',border:'0.5px solid rgba(255,255,255,0.1)'}}>
                    <div style={{width:'40%',height:'7px',borderRadius:'4px',background:tplForm.accent}}/>
                    <div style={{width:'58%',height:'4px',borderRadius:'2px',background:`${tplForm.text}55`}}/>
                    <div style={{width:'26%',height:'11px',borderRadius:'6px',background:tplForm.accent,marginTop:'4px'}}/>
                  </div>

                  <div style={{display:'flex',flexDirection:'column',gap:'13px'}}>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>NAME</label>
                      <input type="text" value={tplForm.name} onChange={e => setTplForm({...tplForm,name:e.target.value})} placeholder="e.g. Ramadan Nights" style={c.inp}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
                      {[['bg','BACKGROUND'],['accent','ACCENT'],['text','TEXT']].map(([k,lab]) => (
                        <div key={k}>
                          <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>{lab}</label>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <input type="color" className="ge-color" value={tplForm[k]} onChange={e => setTplForm({...tplForm,[k]:e.target.value})}/>
                            <span style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase'}}>{tplForm[k]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>FONT PAIR</label>
                        <select value={tplForm.font_pair} onChange={e => setTplForm({...tplForm,font_pair:e.target.value})} style={{...c.inp,cursor:'pointer'}}>
                          {FONT_PAIRS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>PATTERN</label>
                        <select value={tplForm.pattern} onChange={e => setTplForm({...tplForm,pattern:e.target.value})} style={{...c.inp,cursor:'pointer'}}>
                          {PATTERNS.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>OVERLAY</label>
                        <select value={tplForm.overlay} onChange={e => setTplForm({...tplForm,overlay:e.target.value})} style={{...c.inp,cursor:'pointer'}}>
                          {OVERLAYS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>PATTERN OPACITY — {(tplForm.pattern_opacity*100).toFixed(0)}%</label>
                        <input type="range" className="ge-range" min={0.02} max={0.2} step={0.005} value={tplForm.pattern_opacity} onChange={e => setTplForm({...tplForm,pattern_opacity:parseFloat(e.target.value)})} style={{marginTop:'12px'}}/>
                      </div>
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.6)'}}>
                      <input type="checkbox" checked={tplForm.published} onChange={e => setTplForm({...tplForm,published:e.target.checked})}/>
                      Published — visible in the studio gallery
                    </label>
                    <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
                      <button style={{...c.btn(),flex:1,padding:'11px',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.5)'}} onClick={() => setTplModal(false)}>Cancel</button>
                      <button style={{...c.btn('gold'),flex:2,padding:'11px',opacity:tplSaving?0.6:1}} onClick={saveTemplate} disabled={tplSaving}>{tplSaving ? 'Saving…' : tplEdit ? 'Save changes' : 'Create template'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MASJIDS & EVENTS ── */}
        {panel === 'masjids' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Masjids & Events (${masjids.length})`)}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>
                Verified Sunni masjids and Islamic institutes. Add events here — followers are notified automatically, and events auto-expire 24h after they end.
              </p>
              <button style={c.btn('gold')} onClick={() => setMasjidModal(true)}>+ Add masjid</button>
            </div>

            {masjids.length === 0 && (
              <div style={{...c.card,textAlign:'center',padding:'40px',color:'rgba(255,255,255,0.3)',fontFamily:'Georgia,serif',fontStyle:'italic'}}>
                No masjids in the directory yet. Add your first one to start posting events.
              </div>
            )}

            {masjids.map(m => {
              const events = masjidEvents.filter(e => e.masjid_id === m.id)
              return (
                <div key={m.id} style={c.card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontFamily:'Georgia,serif',fontSize:'15px',color:'#fff'}}>{m.name}</span>
                        {m.verified && <span style={c.badge('#1D9E75')}>verified</span>}
                        {m.auto_sync_enabled && <span style={c.badge('#9b8ec4')}>auto-sync {m.auto_sync_trusted ? '· trusted' : '· review'}</span>}
                      </div>
                      <div style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{m.address}</div>
                      {m.auto_sync_enabled && (
                        <div style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'4px'}}>
                          {m.last_synced_at
                            ? <>Last synced {new Date(m.last_synced_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} — {m.last_sync_status === 'error' ? <span style={{color:'#e24b4a'}}>error: {m.last_sync_error}</span> : m.last_sync_status === 'no_events_found' ? 'no events found' : `${m.last_sync_event_count ?? 0} new event(s)`}</>
                            : 'Not synced yet'}
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'flex-end'}}>
                      {m.auto_sync_enabled && <button style={c.btn()} onClick={() => syncMasjidNow(m.id)} disabled={syncingMasjid === m.id}>{syncingMasjid === m.id ? 'Syncing…' : 'Sync now'}</button>}
                      <button style={c.btn()} onClick={() => { setInviteFor(m); setInviteEmail(''); setInviteResult(null) }}>Invite to portal</button>
                      <button style={c.btn('gold')} onClick={() => setEventModal(m.id)}>+ Event</button>
                      <button style={c.btn('red')} onClick={() => deleteMasjid(m.id)}>Remove</button>
                    </div>
                  </div>

                  {events.length > 0 && (
                    <div style={{display:'flex',flexDirection:'column',gap:'6px',marginTop:'10px',borderTop:'0.5px solid rgba(255,255,255,0.06)',paddingTop:'10px'}}>
                      {events.map(e => (
                        <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px'}}>
                          <span style={{fontFamily:'Georgia,serif',color: e.status==='active' ? '#fff' : 'rgba(255,255,255,0.3)'}}>
                            {e.title} <span style={{color:'rgba(255,255,255,0.35)'}}>· {new Date(e.event_start).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                          </span>
                          <span style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={c.badge(e.status==='active'?'#1D9E75':e.status==='cancelled'?'#e24b4a':e.status==='pending'?'#d4a017':'#666')}>{e.status}</span>
                            {e.status === 'pending' && <button onClick={() => approveEvent(e.id)} style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'#1D9E75',background:'none',border:'none',cursor:'pointer'}}>Approve</button>}
                            {e.status === 'active' && <button onClick={() => cancelEvent(e.id)} style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.3)',background:'none',border:'none',cursor:'pointer'}}>Cancel</button>}
                            {e.status === 'pending' && <button onClick={() => cancelEvent(e.id)} style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'#e24b4a',background:'none',border:'none',cursor:'pointer'}}>Reject</button>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add-event modal, scoped to this masjid */}
                  {eventModal === m.id && (
                    <div style={{marginTop:'14px',borderTop:'0.5px solid rgba(212,175,110,0.15)',paddingTop:'14px',display:'flex',flexDirection:'column',gap:'10px'}}>
                      <input type="text" placeholder="Event title" value={eventForm.title} onChange={e => setEventForm({...eventForm,title:e.target.value})} style={c.inp}/>
                      <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm({...eventForm,description:e.target.value})} style={{...c.inp,minHeight:'60px',resize:'vertical'}}/>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                        <div>
                          <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'4px'}}>STARTS</label>
                          <input type="datetime-local" value={eventForm.event_start} onChange={e => setEventForm({...eventForm,event_start:e.target.value})} style={{...c.inp,colorScheme:'dark'}}/>
                        </div>
                        <div>
                          <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'4px'}}>ENDS</label>
                          <input type="datetime-local" value={eventForm.event_end} onChange={e => setEventForm({...eventForm,event_end:e.target.value})} style={{...c.inp,colorScheme:'dark'}}/>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button style={{...c.btn(),flex:1}} onClick={() => setEventModal(null)}>Cancel</button>
                        <button style={{...c.btn('gold'),flex:2,opacity:eventSaving?0.6:1}} onClick={() => saveEvent(m.id)} disabled={eventSaving}>{eventSaving ? 'Posting…' : 'Post event & notify followers'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add-masjid modal */}
            {masjidModal && (
              <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}} onClick={() => setMasjidModal(false)}>
                <div style={{...c.card,width:'100%',maxWidth:'480px',padding:'24px'}} onClick={e => e.stopPropagation()}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'#d4af6e',marginBottom:'18px'}}>ADD MASJID</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'5px'}}>NAME</label>
                      <input type="text" value={masjidForm.name} onChange={e => setMasjidForm({...masjidForm,name:e.target.value})} placeholder="Masjid Al-Noor" style={c.inp}/>
                    </div>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'5px'}}>ADDRESS (search Google Maps)</label>
                      <MosqueAutocomplete onSelect={setMasjidPlace} inputStyle={c.inp}/>
                      {masjidPlace && <div style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'#1D9E75',marginTop:'6px'}}>✓ {masjidPlace.formattedAddress}</div>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                      <input type="text" placeholder="Instagram handle" value={masjidForm.instagram_handle} onChange={e => setMasjidForm({...masjidForm,instagram_handle:e.target.value})} style={c.inp}/>
                      <input type="text" placeholder="Phone" value={masjidForm.phone} onChange={e => setMasjidForm({...masjidForm,phone:e.target.value})} style={c.inp}/>
                    </div>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'5px'}}>WEBSITE (their events/announcements page, if they have one)</label>
                      <input type="text" placeholder="https://masjidname.org/events" value={masjidForm.website} onChange={e => setMasjidForm({...masjidForm,website:e.target.value})} style={c.inp}/>
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.6)'}}>
                      <input type="checkbox" checked={masjidForm.auto_sync_enabled} onChange={e => setMasjidForm({...masjidForm,auto_sync_enabled:e.target.checked})} disabled={!masjidForm.website}/>
                      Auto-sync events from their website (AI-extracted, held for your review before publishing)
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.6)'}}>
                      <input type="checkbox" checked={masjidForm.verified} onChange={e => setMasjidForm({...masjidForm,verified:e.target.checked})}/>
                      Verified (confirmed real, active institution)
                    </label>
                    <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
                      <button style={{...c.btn(),flex:1}} onClick={() => setMasjidModal(false)}>Cancel</button>
                      <button style={{...c.btn('gold'),flex:2,opacity:masjidSaving?0.6:1}} onClick={saveMasjid} disabled={masjidSaving || !masjidForm.name}>{masjidSaving ? 'Saving…' : 'Add to directory'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {panel === 'orders' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Orders (${orders.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Order #','Customer','Type','Total','Status','Date'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)',letterSpacing:'0.06em'}}>{order.order_number}</td>
                      <td style={c.td}>{order.customer_name || order.customer_email}</td>
                      <td style={{...c.td,fontSize:'12px'}}>{order.order_type}</td>
                      <td style={{...c.td,color:'#d4af6e'}}>${order.total?.toFixed(2)}</td>
                      <td style={c.td}>
                        <select value={order.status} onChange={async e => {
                          await supabase.from('orders').update({status:e.target.value}).eq('id',order.id)
                          setOrders(os => os.map(o => o.id===order.id?{...o,status:e.target.value}:o))
                        }} style={{background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(212,175,110,0.2)',borderRadius:'6px',padding:'4px 8px',fontFamily:'Georgia,serif',fontSize:'11px',color:'#fff',cursor:'pointer'}}>
                          {['pending','processing','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{new Date(order.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PORTAL INVITE MODAL ── */}
        {inviteFor && (
          <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(4,10,4,0.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={() => !inviteBusy && setInviteFor(null)}>
            <div style={{...c.card,width:'100%',maxWidth:'480px',background:'#0d1f0d'}} onClick={e => e.stopPropagation()}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.2em',color:'#d4af6e',marginBottom:'6px'}}>MASJID PORTAL</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:'17px',color:'#fff',marginBottom:'4px'}}>Invite {inviteFor.name}</div>
              <p style={{fontFamily:'Georgia,serif',fontSize:'13px',color:'rgba(255,255,255,0.45)',lineHeight:1.65,marginBottom:'18px'}}>
                They&apos;ll get a one-time link to set their own password. You never see or set it. The link expires in 7 days.
              </p>

              <label style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.4)',display:'block',marginBottom:'6px'}}>IMAM / ADMIN EMAIL</label>
              <input
                type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="imam@masjid.org"
                style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(212,175,110,0.25)',borderRadius:'9px',padding:'11px 13px',fontFamily:'Georgia,serif',fontSize:'14px',color:'#fff',outline:'none',marginBottom:'16px'}}
              />

              {inviteResult?.error && (
                <p style={{fontFamily:'Georgia,serif',fontSize:'13px',color:'#e87573',marginBottom:'14px'}}>{inviteResult.error}</p>
              )}
              {inviteResult?.link && (
                <div style={{background:'rgba(46,107,46,0.12)',border:'0.5px solid rgba(46,107,46,0.3)',borderRadius:'9px',padding:'12px 14px',marginBottom:'14px'}}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'#5a9e5a',marginBottom:'6px'}}>
                    {inviteResult.emailed ? 'Invitation emailed.' : 'Invitation created — email could not be sent, so share this link yourself:'}
                  </div>
                  <div style={{fontFamily:'monospace',fontSize:'11px',color:'rgba(255,255,255,0.65)',wordBreak:'break-all'}}>{inviteResult.link}</div>
                </div>
              )}

              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => setInviteFor(null)} disabled={inviteBusy} style={{...c.btn(),flex:1}}>
                  {inviteResult?.link ? 'Done' : 'Cancel'}
                </button>
                {!inviteResult?.link && (
                  <button onClick={sendPortalInvite} disabled={inviteBusy || !inviteEmail} style={{...c.btn('gold'),flex:2}}>
                    {inviteBusy ? 'Sending…' : 'Send invitation'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {panel === 'users' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Users (${users.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Mosque','Newsletter','Onboarded','Role'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td style={c.td}>{user.first_name||''} {user.last_name||''} <span style={{fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{user.full_name&&!user.first_name?`(${user.full_name})`:''}</span></td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{user.email}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{user.local_mosque||'—'}</td>
                      <td style={c.td}><span style={c.badge(user.newsletter_opted_in?'#1D9E75':'rgba(255,255,255,0.25)')}>{user.newsletter_opted_in?'Yes':'No'}</span></td>
                      <td style={c.td}><span style={c.badge(user.onboarding_complete?'#1D9E75':'#d4a017')}>{user.onboarding_complete?'Yes':'Pending'}</span></td>
                      <td style={c.td}><span style={c.badge(user.role==='admin'?'#d4af6e':'rgba(255,255,255,0.25)')}>{user.role||'user'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── NEWSLETTER ── */}
        {panel === 'newsletter' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            {sectionTitle(`Newsletter (${subscribers.length} subscribers)`)}

            {/* Compose */}
            <div style={c.card}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.5)',marginBottom:'16px'}}>COMPOSE NEWSLETTER</div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div>
                  <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>SUBJECT LINE</label>
                  <input type="text" value={newsletterSubject} onChange={e => setNewsletterSubject(e.target.value)} placeholder="e.g. Ramadan Mubarak from Green Emblem" style={c.inp}/>
                </div>
                <div>
                  <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>BODY (plain text or HTML)</label>
                  <textarea value={newsletterBody} onChange={e => setNewsletterBody(e.target.value)} placeholder="Write your newsletter here…" rows={10} style={{...c.inp,resize:'vertical' as const,lineHeight:1.6}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                  <button onClick={sendNewsletter} disabled={sendingNewsletter||!newsletterSubject||!newsletterBody} style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.14em',color:'#0f1f0f',background:newsletterSubject&&newsletterBody?'#d4af6e':'rgba(255,255,255,0.15)',border:'none',borderRadius:'8px',padding:'12px 24px',cursor:newsletterSubject&&newsletterBody?'pointer':'not-allowed',opacity:sendingNewsletter?0.6:1}}>
                    {sendingNewsletter?'Sending…':newsletterSent?'Sent!`':`Send to ${subscribers.length} subscribers`}
                  </button>
                  <span style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.3)',fontStyle:'italic'}}>Via Resend · green-emblem.com</span>
                </div>
              </div>
            </div>

            {/* Subscriber list */}
            <div style={c.card}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.5)',marginBottom:'16px'}}>SUBSCRIBER LIST</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Source','Subscribed'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {subscribers.map(sub => (
                    <tr key={sub.id}>
                      <td style={c.td}>{sub.first_name||''} {sub.last_name||''}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{sub.email}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{sub.source}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{new Date(sub.subscribed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
GE_EOF_15FB11B7

echo "  writing verify-portal.mjs"
save 'verify-portal.mjs'
cat > 'verify-portal.mjs' <<'GE_EOF_BE6FBF6E'
import { chromium } from 'playwright'

const PORT = process.argv[2] || '3150'
const MAIN = `http://localhost:${PORT}`
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0
const check = (n, ok, x = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + x}`)
  if (!ok) fail++
}

// Host headers can't be overridden in Playwright, so the portal is reached
// through a real *.localhost subdomain (RFC 6761 — resolves to loopback).
const PORTAL = `http://masjid.localhost:${PORT}`
const portalCtx = await b.newContext()
const mainCtx = await b.newContext()

console.log('\n[1] Hostname routing selects the right app')
{
  const p = await portalCtx.newPage()
  const res = await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'domcontentloaded' })
  check('portal host serves the portal sign-in', res.status() === 200, 'HTTP ' + res.status())
  const txt = (await p.textContent('body')) || ''
  check('shows MASJID PORTAL branding', /MASJID PORTAL/i.test(txt), txt.slice(0, 100))
  check('does not show the consumer nav', !/Baab As-Sadaqah|GreenWorld/i.test(txt))
  await p.close()

  const q = await mainCtx.newPage()
  await q.goto(`${MAIN}/`, { waitUntil: 'domcontentloaded' })
  const mainTxt = (await q.textContent('body')) || ''
  check('main host still serves the consumer app', /Green Emblem/i.test(mainTxt))
  await q.close()
}

console.log('\n[2] Portal pages are gated')
{
  for (const path of ['/', '/posts', '/posts/new', '/profile']) {
    const p = await portalCtx.newPage()
    await p.goto(`${PORTAL}${path}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(2500)
    const url = p.url()
    check(`${path} redirects an anonymous visitor to sign-in`, url.includes('/sign-in') || url.includes('/portal/sign-in'), url)
    await p.close()
  }
}

console.log('\n[3] Portal APIs reject non-members')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'domcontentloaded' })
  for (const [path, method] of [
    ['/api/portal/posts', 'GET'],
    ['/api/portal/posts', 'POST'],
    ['/api/portal/invite', 'POST'],
  ]) {
    const status = await p.evaluate(async ([u, m]) => {
      const r = await fetch(u, {
        method: m,
        headers: { 'Content-Type': 'application/json' },
        body: m === 'GET' ? undefined : '{}',
      })
      return r.status
    }, [`${PORTAL}${path}`, method])
    check(`${method} ${path} rejects anonymous`, status === 403 || status === 401, 'HTTP ' + status)
  }
  await p.close()
}

console.log('\n[4] Invite links validate before asking for a password')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/invite/not-a-real-token`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2000)
  const txt = (await p.textContent('body')) || ''
  // Any of the four honest outcomes is fine; what must never happen is
  // spinning on LOADING… or silently offering a password form.
  check(
    'bad token shows an explanation, not a password form',
    /isn.t valid|not valid|expired|already been used|couldn.t check/i.test(txt),
    txt.slice(0, 160)
  )
  check('does not hang on a loading state', !/LOADING…/.test(txt), txt.slice(0, 80))
  const hasPw = await p.evaluate(() => !!document.querySelector('input[type="password"]'))
  check('no password field is offered for an invalid invite', !hasPw)
  await p.close()
}

console.log('\n[5] RSVP endpoint: "Going" only, and auth-gated')
{
  const p = await mainCtx.newPage()
  await p.goto(`${MAIN}/`, { waitUntil: 'domcontentloaded' })
  const fake = '00000000-0000-0000-0000-000000000000'
  const results = await p.evaluate(async ([base, id]) => {
    const out = {}
    const g = await fetch(`${base}/api/posts/${id}/rsvp`)
    out.getStatus = g.status
    out.getBody = await g.text()
    const post = await fetch(`${base}/api/posts/${id}/rsvp`, { method: 'POST' })
    out.postStatus = post.status
    const del = await fetch(`${base}/api/posts/${id}/rsvp`, { method: 'DELETE' })
    out.delStatus = del.status
    // There must be no endpoint that records non-attendance
    const notGoing = await fetch(`${base}/api/posts/${id}/rsvp`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ going: false }),
    })
    out.putStatus = notGoing.status
    return out
  }, [MAIN, fake])

  check('anonymous GET returns a count', results.getStatus === 200, 'HTTP ' + results.getStatus)
  check('GET response has no "not going" field', !/not_?going|declin|skip/i.test(results.getBody), results.getBody?.slice(0, 100))
  check('anonymous POST is rejected', results.postStatus === 401, 'HTTP ' + results.postStatus)
  check('anonymous DELETE is rejected', results.delStatus === 401, 'HTTP ' + results.delStatus)
  check('no PUT handler exists (no way to record absence)', results.putStatus === 405, 'HTTP ' + results.putStatus)
  await p.close()
}

console.log('\n[6] Portal is kept out of search engines')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'domcontentloaded' })
  const robots = await p.evaluate(() =>
    document.querySelector('meta[name="robots"]')?.getAttribute('content') || '')
  check('portal sets noindex', /noindex/i.test(robots), robots || '(none)')
  await p.close()
}

console.log('\n[7] Portal layout has no consumer chrome')
{
  const p = await portalCtx.newPage()
  await p.goto(`${PORTAL}/sign-in`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const chrome = await p.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Primary"]')
    return {
      bottomNav: !!bar,
      // Belt and braces: even in the frame before hydration unmounts it,
      // the portal layout's stylesheet must keep it off the screen.
      bottomNavVisible: !!bar && getComputedStyle(bar).display !== 'none',
      consumerNav: !!document.querySelector('nav[aria-label="Main navigation"]'),
      bodyPadding: getComputedStyle(document.body).paddingBottom,
    }
  })
  check('no consumer bottom tab bar in the DOM', !chrome.bottomNav)
  check('bottom tab bar is not visible even pre-hydration', !chrome.bottomNavVisible)
  check('no consumer top nav', !chrome.consumerNav)
  check('no tab-bar padding reserved on body', chrome.bodyPadding === '0px', chrome.bodyPadding)
  await p.close()

  // The failure mode of the fix above is removing the tab bar everywhere.
  // Prove the consumer app still has it, on a phone viewport.
  const q = await mainCtx.newPage()
  await q.setViewportSize({ width: 390, height: 844 })
  await q.goto(`${MAIN}/`, { waitUntil: 'networkidle' })
  await q.waitForTimeout(1200)
  const consumer = await q.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Primary"]')
    return { present: !!bar, visible: !!bar && getComputedStyle(bar).display !== 'none' }
  })
  check('consumer app STILL has its bottom tab bar on mobile', consumer.present && consumer.visible,
    JSON.stringify(consumer))
  await q.close()
}

await b.close()
console.log(fail === 0 ? '\nALL CHECKS PASSED\n' : `\n${fail} CHECK(S) FAILED\n`)
process.exit(fail ? 1 : 0)
GE_EOF_BE6FBF6E


# ── Verification ────────────────────────────────────────────────────────
echo
echo "→ Verifying"
FAIL=0
ck() { # ck <path> <sentinel>
  if [ ! -f "$1" ]; then echo "  ✗ MISSING  $1"; FAIL=1; return; fi
  if [ -n "${2:-}" ] && ! grep -qF -- "$2" "$1"; then
    echo "  ✗ TRUNCATED $1 (expected to contain: $2)"; FAIL=1; return
  fi
  echo "  ✓ $1"
}

ck 'masjid-portal.sql' 'posts_rsvp_counts'
ck 'middleware.ts' 'isPortalHost'
ck 'lib/portal.ts' 'requireMasjidMember'
ck 'lib/surface.ts' 'HIDE_CONSUMER_CHROME_CSS'
ck 'lib/email.ts' 'sendMasjidInvite'
ck 'app/api/portal/invite/route.ts' ''
ck 'app/api/portal/invite/accept/route.ts' ''
ck 'app/api/portal/posts/route.ts' ''
ck 'app/api/portal/posts/[id]/route.ts' ''
ck 'app/api/posts/[id]/rsvp/route.ts' 'export async function DELETE'
ck 'app/portal/layout.tsx' 'HIDE_CONSUMER_CHROME_CSS'
ck 'app/portal/page.tsx' ''
ck 'app/portal/sign-in/page.tsx' ''
ck 'app/portal/invite/[token]/page.tsx' 'unavailable'
ck 'app/portal/posts/page.tsx' ''
ck 'app/portal/posts/new/page.tsx' ''
ck 'app/portal/posts/[id]/page.tsx' ''
ck 'app/portal/profile/page.tsx' ''
ck 'components/portal/PortalShell.tsx' ''
ck 'components/portal/PortalGuard.tsx' 'retry=1'
ck 'components/portal/PostForm.tsx' 'fundraiser'
ck 'components/RsvpButton.tsx' "You're going"
ck 'components/BottomNav.tsx' 'isConsumerSurface'
ck 'components/PWARegister.tsx' 'isConsumerSurface'
ck 'components/InstallPrompt.tsx' 'isConsumerSurface'
ck 'app/greenworld-plus/page.tsx' 'RsvpButton'
ck 'app/admin/page.tsx' 'Invite to portal'
ck 'verify-portal.mjs' ''

echo
if [ "$FAIL" -ne 0 ]; then
  echo "════════════════════════════════════════════════════════════"
  echo " SOME FILES DID NOT APPLY. Do not commit. Re-run the script."
  echo "════════════════════════════════════════════════════════════"
  exit 1
fi

echo "════════════════════════════════════════════════════════════════"
echo " ALL FILES APPLIED"
echo "════════════════════════════════════════════════════════════════"
echo
echo " NEXT — three things, in this order:"
echo
echo " 1. DATABASE"
echo "    Supabase → SQL Editor → paste all of masjid-portal.sql → Run."
echo "    Safe to run twice."
echo
echo " 2. DNS + VERCEL  (the portal needs its own hostname)"
echo "    a) Vercel → your project → Settings → Domains → Add:"
echo "         masjid.green-emblem.com"
echo "    b) At your DNS provider add the CNAME Vercel shows you:"
echo "         masjid  CNAME  cname.vercel-dns.com"
echo "    c) Vercel → Settings → Environment Variables → add:"
echo "         NEXT_PUBLIC_PORTAL_HOST = masjid.green-emblem.com"
echo "       (all three environments), then redeploy."
echo
echo " 3. DEPLOY"
echo "    git add -A"
echo "    git commit -m 'Masjid portal phase 1'"
echo "    git push"
echo
echo " Then: sign in at green-emblem.com/admin, open a masjid, and click"
echo " 'Invite to portal'. They get an email, set their own password, and"
echo " land in the dashboard. No password is ever generated or seen by you."
echo

