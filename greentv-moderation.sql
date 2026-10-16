-- ════════════════════════════════════════════════════════════════════════
--  GreenTV moderation — remove Telegram-fed posts from the app
--
--  Run once in Supabase → SQL Editor. Safe to run twice.
--
--  WHY A FLAG AND NOT A DELETE
--  app/api/telegram/webhook/route.ts upserts on telegram_message_id and
--  also handles edited_channel_post. A hard-deleted row therefore returns,
--  visible, the next time that message is edited in the Telegram channel.
--  Because an upsert only writes the columns it lists, hidden_at is left
--  untouched on conflict — so the row itself is what makes the removal
--  stick.
-- ════════════════════════════════════════════════════════════════════════

alter table public.greentv_posts
  add column if not exists hidden_at timestamptz;

alter table public.greentv_posts
  add column if not exists hidden_by uuid references auth.users(id) on delete set null;

comment on column public.greentv_posts.hidden_at is
  'Set by the admin console to pull this post from the app. Must survive the Telegram upsert — never include it in the webhook payload.';

-- The app only ever reads visible posts in reverse date order, so index
-- exactly that. A partial index also stays small as hidden rows accumulate.
create index if not exists greentv_posts_visible_idx
  on public.greentv_posts (posted_at desc)
  where hidden_at is null;

-- ── Check it worked ─────────────────────────────────────────────────────
-- select count(*) as total,
--        count(hidden_at) as hidden,
--        count(*) - count(hidden_at) as visible
-- from public.greentv_posts;
