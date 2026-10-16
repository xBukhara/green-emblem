-- ════════════════════════════════════════════════════════════════════════
--  Quran reading progress, bookmarks and notes
--
--  Run once in Supabase → SQL Editor. Safe to run twice.
--
--  The app degrades gracefully if this has NOT been run: the reader still
--  works, the bookmark strip hides itself, and the Reward Tracker shows a
--  "not set up yet" state instead of an error. That is deliberate — a
--  migration-dependent read that returns nothing once looked exactly like
--  data loss (see claude/greentv-moderation.md), and it is not happening
--  again inside the Quran.
-- ════════════════════════════════════════════════════════════════════════

-- ── Verses the reader has marked as read ────────────────────────────────
-- One row per user per verse. `letters` is counted SERVER-SIDE from the
-- Complex's own text at the moment of marking (see lib/hasanat.ts), never
-- taken from the client — the whole point of the counter is that the number
-- means something.
create table if not exists public.quran_read (
  user_id   uuid     not null references auth.users(id) on delete cascade,
  surah     smallint not null check (surah between 1 and 114),
  ayah      smallint not null check (ayah >= 1),
  letters   integer  not null default 0 check (letters >= 0 and letters <= 3000),
  read_at   timestamptz not null default now(),
  primary key (user_id, surah, ayah)
);

-- Resume position is the most recent mark, so that ordering is the hot path.
create index if not exists quran_read_recent_idx
  on public.quran_read (user_id, read_at desc);

-- ── Stars and notes ─────────────────────────────────────────────────────
-- One row per user per verse carrying both, because the slide-out strip
-- offers both on the same verse and two tables would mean two writes.
create table if not exists public.quran_bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid     not null references auth.users(id) on delete cascade,
  surah      smallint not null check (surah between 1 and 114),
  ayah       smallint not null check (ayah >= 1),
  starred    boolean  not null default false,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, surah, ayah),
  -- A row with neither a star nor a note is litter; the API deletes instead.
  constraint quran_bookmarks_not_empty
    check (starred or (note is not null and length(btrim(note)) > 0))
);

create index if not exists quran_bookmarks_user_idx
  on public.quran_bookmarks (user_id, updated_at desc);

alter table public.quran_read      enable row level security;
alter table public.quran_bookmarks enable row level security;

-- ── RLS: your own reading is yours ──────────────────────────────────────
-- Reading history and private notes are about as personal as this app gets.
-- No policy grants anyone sight of another person's rows, and nothing in the
-- app aggregates them across users.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'quran_read' and policyname = 'own rows') then
    create policy "own rows" on public.quran_read
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'quran_bookmarks' and policyname = 'own rows') then
    create policy "own rows" on public.quran_bookmarks
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── Check it worked ─────────────────────────────────────────────────────
-- select
--   (select count(*) from public.quran_read)      as marked_verses,
--   (select count(*) from public.quran_bookmarks) as bookmarks;
