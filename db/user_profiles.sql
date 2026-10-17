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
