-- "Watched": whole shows/movies a user has finished (not episodes).
-- Run once in Supabase -> SQL Editor. Until then the site keeps the Watched list
-- in this browser only; after this it syncs to the account.

create table if not exists public.watched (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  media_type  text not null check (media_type in ('anime', 'movie', 'tv')),
  tmdb_id     integer,
  mal_id      integer,
  title       text not null,
  poster      text,
  score       numeric,
  genres      text[],
  year        integer,
  minutes     integer,
  episodes    integer,
  watched_at  timestamptz not null default now()
);

create unique index if not exists watched_unique
  on public.watched (user_id, media_type, coalesce(tmdb_id, 0), coalesce(mal_id, 0));

alter table public.watched enable row level security;

drop policy if exists "watched_select_own" on public.watched;
create policy "watched_select_own" on public.watched for select using (auth.uid() = user_id);
drop policy if exists "watched_insert_own" on public.watched;
create policy "watched_insert_own" on public.watched for insert with check (auth.uid() = user_id);
drop policy if exists "watched_update_own" on public.watched;
create policy "watched_update_own" on public.watched for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "watched_delete_own" on public.watched;
create policy "watched_delete_own" on public.watched for delete using (auth.uid() = user_id);
