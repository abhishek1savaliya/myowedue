-- Unique community @handles (Supabase / Postgres), keyed by app user id (Mongo ObjectId string).

create table if not exists public.community_usernames (
  user_id text primary key,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_username_format check (username ~ '^[a-z0-9_]{6,21}$'),
  constraint community_usernames_username_unique unique (username)
);

create index if not exists idx_community_usernames_username on public.community_usernames (username);

alter table public.community_usernames enable row level security;

drop policy if exists "community_usernames_read" on public.community_usernames;
create policy "community_usernames_read" on public.community_usernames for select using (true);
