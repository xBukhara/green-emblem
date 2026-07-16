-- ═══════════════════════════════════════════════════════════════════
--  DESIGN STUDIO + STREAMLINED CAMPAIGN FLOW
--  Run this in Supabase SQL Editor (safe to run more than once)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Template gallery table (admin-managed, shown in the design studio)
create table if not exists campaign_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  bg              text not null default '#0f1f0f',
  accent          text not null default '#d4af6e',
  text            text not null default '#f5f0e6',
  font_pair       text not null default 'cinzel',
  pattern         text not null default 'star8',
  overlay         text not null default 'frame',
  pattern_opacity numeric not null default 0.07,
  published       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

alter table campaign_templates enable row level security;

-- Anyone can read published templates (the studio gallery)
drop policy if exists "read published templates" on campaign_templates;
create policy "read published templates" on campaign_templates
  for select using (published = true);

-- Admins can do everything (read drafts, create, update, delete)
drop policy if exists "admins manage templates" on campaign_templates;
create policy "admins manage templates" on campaign_templates
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 2. Streamlined flow — campaigns go live on creation (no approval gate).
--    The API now inserts with status 'active'; this default matches it,
--    and any lingering 'pending' campaigns are activated.
alter table campaigns alter column status set default 'active';
update campaigns set status = 'active' where status = 'pending';

-- 3. Requests are auto-approved on submission by the new API.
--    Approve any old pending requests so their owners can be sent links.
update campaign_requests set status = 'approved' where status = 'pending';
