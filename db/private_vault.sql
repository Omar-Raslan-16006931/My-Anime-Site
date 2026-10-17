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
