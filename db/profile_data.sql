-- Separate data per profile: each "Who's watching?" profile gets its own My List, Continue watching,
-- Watched titles and episode progress. Run once in Supabase -> SQL Editor. Safe to re-run.
--
-- What it does, for each of the six personal tables:
--   1. adds   profile_id text not null default 'main'   (everything you already have becomes the first profile's)
--   2. widens every unique index / primary key that contains user_id to also include profile_id,
--      so two profiles can save the same title without colliding.
-- Row-level security is unchanged (still "auth.uid() = user_id"). Run db/user_profiles.sql first.

do $$
declare
  t text;
  r record;
  newdef text;
begin
  foreach t in array array['watchlist','watched','currently_watching','currently_watching_tmdb','anime_episode_progress','tv_episode_progress'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping % (table not found)', t;
      continue;
    end if;

    execute format('alter table public.%I add column if not exists profile_id text not null default ''main''', t);

    for r in
      select i.indexrelid as oid,
             c.conname,
             c.contype,
             pg_get_indexdef(i.indexrelid) as def,
             ic.relname as idxname
      from pg_index i
      join pg_class ic on ic.oid = i.indexrelid
      left join pg_constraint c on c.conindid = i.indexrelid and c.contype in ('p', 'u')
      where i.indrelid = ('public.' || t)::regclass
        and i.indisunique
        and pg_get_indexdef(i.indexrelid) ~ '\(user_id,'
        and pg_get_indexdef(i.indexrelid) !~ 'profile_id'
    loop
      newdef := regexp_replace(r.def, '\(user_id,', '(user_id, profile_id,');
      newdef := regexp_replace(newdef, '(CREATE UNIQUE INDEX )(\S+)( ON)', '\1IF NOT EXISTS ' || quote_ident(left(r.idxname, 52) || '_pid') || '\3');
      if r.conname is not null then
        execute format('alter table public.%I drop constraint %I', t, r.conname);
      else
        execute format('drop index if exists public.%I', r.idxname);
      end if;
      execute newdef;
    end loop;
  end loop;
end $$;

-- Quick check: every one of these should now list profile_id inside a unique index.
-- select tablename, indexdef from pg_indexes where schemaname = 'public'
--   and tablename in ('watchlist','watched','currently_watching','currently_watching_tmdb','anime_episode_progress','tv_episode_progress')
--   and indexdef like '%UNIQUE%';
