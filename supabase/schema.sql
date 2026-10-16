-- The Greatest Food Ballot: run once in the Supabase SQL editor.

create table if not exists public.ballots (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  image_path     text not null,
  thumb_path     text not null,
  processed_path text,                                     -- model's own image (optional)
  prediction     smallint not null check (prediction between -1 and 26),
  confidence     real,
  scores         jsonb,
  model_version  text,
  latency_ms     integer,
  analysis       jsonb,                                    -- pipeline verdict/reason/marks (no image)
  nickname       text check (char_length(nickname) <= 24),
  feedback       smallint check (feedback in (-1, 1)),    -- 👍 = 1, 👎 = -1
  hidden         boolean not null default false            -- moderation switch
);

-- Upgrades for a table created by an earlier version of this file.
alter table public.ballots add column if not exists processed_path text;
alter table public.ballots add column if not exists analysis jsonb;

create index if not exists ballots_created_at_idx on public.ballots (created_at desc);

create or replace view public.rankings with (security_invoker = true) as
  select prediction as candidate, count(*)::int as votes
  from public.ballots
  where hidden = false and prediction between 1 and 26
  group by prediction;

create or replace view public.ballot_stats with (security_invoker = true) as
  select count(*)::int as total,
         count(*) filter (where prediction = 0)::int  as abstained,
         count(*) filter (where prediction = -1)::int as spoiled,
         round(avg(latency_ms))::int as avg_latency_ms
  from public.ballots where hidden = false;

alter table public.ballots enable row level security;
drop policy if exists "public read" on public.ballots;
create policy "public read" on public.ballots for select using (hidden = false);
-- No insert/update policies: only the server (service role) writes.

-- Realtime inserts for the Log wall, ticker and race bars (safe to re-run).
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ballots') then
    alter publication supabase_realtime add table public.ballots;
  end if;
end $$;

-- Storage: public-read bucket. Paths: full/{id}.jpg, thumb/{id}.jpg, processed/{id}.{jpg|png}
insert into storage.buckets (id, name, public)
values ('ballots', 'ballots', true)
on conflict (id) do update set public = true;

-- Uploads/deletes only happen server-side with the service role (bypasses RLS),
-- so no storage policies are needed. Public URLs work because the bucket is public.
