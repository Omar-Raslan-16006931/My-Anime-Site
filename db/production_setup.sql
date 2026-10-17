-- Yoru: everything the new version needs, in one go. Safe to re-run.
-- Supabase -> SQL Editor -> paste -> Run.

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

-- TV "watched" episodes for Yoru.
-- Run once in Supabase -> SQL Editor. Until then the site stores watched
-- episodes in the browser only; after this they sync to the account.

create table if not exists public.tv_episode_progress (
  user_id        uuid    not null references auth.users(id) on delete cascade,
  tmdb_id        integer not null,
  season_number  integer not null,
  episode_number integer not null,
  seen           boolean not null default true,
  seen_at        timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, tmdb_id, season_number, episode_number)
);

alter table public.tv_episode_progress enable row level security;

drop policy if exists "tv_progress_select_own" on public.tv_episode_progress;
create policy "tv_progress_select_own" on public.tv_episode_progress
  for select using (auth.uid() = user_id);

drop policy if exists "tv_progress_insert_own" on public.tv_episode_progress;
create policy "tv_progress_insert_own" on public.tv_episode_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "tv_progress_update_own" on public.tv_episode_progress;
create policy "tv_progress_update_own" on public.tv_episode_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tv_progress_delete_own" on public.tv_episode_progress;
create policy "tv_progress_delete_own" on public.tv_episode_progress
  for delete using (auth.uid() = user_id);

-- Private history vault: one end-to-end-encrypted blob per user.
-- Run once in Supabase -> SQL Editor. Safe to re-run.

create table if not exists public.private_vault (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  salt       text not null,
  iv         text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.private_vault enable row level security;

drop policy if exists "vault_select_own" on public.private_vault;
create policy "vault_select_own" on public.private_vault for select using (auth.uid() = user_id);
drop policy if exists "vault_insert_own" on public.private_vault;
create policy "vault_insert_own" on public.private_vault for insert with check (auth.uid() = user_id);
drop policy if exists "vault_update_own" on public.private_vault;
create policy "vault_update_own" on public.private_vault for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "vault_delete_own" on public.private_vault;
create policy "vault_delete_own" on public.private_vault for delete using (auth.uid() = user_id);

-- "Who's watching?" profiles, synced to the account so they follow you across devices.
-- Run once in Supabase -> SQL Editor. Safe to re-run. Until then profiles stay on each device.
-- Profile photos reuse the existing public "avatars" storage bucket (folder = your user id).

create table if not exists public.user_profiles (
  user_id    uuid    not null references auth.users(id) on delete cascade,
  id         text    not null,
  name       text    not null check (char_length(name) between 1 and 18),
  hue        integer not null default 0,
  kids       boolean not null default false,
  avatar_url text,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles for select using (auth.uid() = user_id);
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own" on public.user_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_profiles_delete_own" on public.user_profiles;
create policy "user_profiles_delete_own" on public.user_profiles for delete using (auth.uid() = user_id);
