-- TV "watched" episodes for AniWave.
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
