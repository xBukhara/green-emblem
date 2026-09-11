-- ═══════════════════════════════════════════════════════════════════
--  GREEN EMBLEM — PUSH NOTIFICATIONS
--  Run in the Supabase SQL Editor. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Subscriptions ──────────────────────────────────────────────────
-- One row per browser/device. A user can have several (phone, laptop).
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,

  -- Prayer alerts need a location and a timezone. Coordinates are stored
  -- rounded to 2dp (~1.1 km) — plenty for prayer times, and deliberately
  -- too coarse to identify a home address.
  lat           numeric(6,2),
  lng           numeric(6,2),
  timezone      text,
  calc_method   text default 'MuslimWorldLeague',
  madhab        text default 'shafi',

  -- Per-category opt-ins
  notify_prayer_daily  boolean not null default true,   -- one digest each morning
  notify_prayer_each   boolean not null default false,  -- per-prayer (needs Vercel Pro)
  notify_masjid_events boolean not null default true,

  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_sent_at  timestamptz,
  failure_count int not null default 0
);

create index if not exists push_subs_user_idx   on push_subscriptions (user_id);
create index if not exists push_subs_prayer_idx on push_subscriptions (notify_prayer_daily) where notify_prayer_daily;
create index if not exists push_subs_each_idx   on push_subscriptions (notify_prayer_each)  where notify_prayer_each;

-- 2. Delivery log — prevents double-sending a prayer alert when the
--    per-minute cron overlaps or retries.
create table if not exists push_sent_log (
  id           uuid primary key default gen_random_uuid(),
  endpoint     text not null,
  kind         text not null,          -- 'prayer_daily' | 'prayer_fajr' | ... | 'masjid_event'
  dedupe_key   text not null,          -- e.g. '2026-09-10:fajr'
  sent_at      timestamptz not null default now(),
  unique (endpoint, kind, dedupe_key)
);
create index if not exists push_log_sent_idx on push_sent_log (sent_at desc);

-- Keep the log from growing forever
create or replace function prune_push_log()
returns void language sql security definer set search_path = public as $$
  delete from push_sent_log where sent_at < now() - interval '14 days';
$$;

-- 3. RLS ────────────────────────────────────────────────────────────
alter table push_subscriptions enable row level security;
alter table push_sent_log      enable row level security;

drop policy if exists "own push subscriptions" on push_subscriptions;
create policy "own push subscriptions" on push_subscriptions
  for select using (user_id = auth.uid());

-- All writes go through the API using the service role, so there are no
-- client insert/update policies on purpose. The log is server-only.

drop policy if exists "admins read push log" on push_sent_log;
create policy "admins read push log" on push_sent_log
  for select using (exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));
