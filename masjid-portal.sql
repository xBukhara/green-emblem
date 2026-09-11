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
