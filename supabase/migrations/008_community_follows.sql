-- Member follows (follower → following), keyed by app user ids (Mongo ObjectId strings).

create table if not exists public.community_follows (
  follower_id text not null,
  following_id text not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint community_follows_no_self check (follower_id <> following_id)
);

create index if not exists idx_community_follows_following on public.community_follows (following_id);
create index if not exists idx_community_follows_follower on public.community_follows (follower_id);

alter table public.community_follows enable row level security;

drop policy if exists "community_follows_read" on public.community_follows;
create policy "community_follows_read" on public.community_follows for select using (true);

drop policy if exists "community_follows_no_write" on public.community_follows;
create policy "community_follows_no_write" on public.community_follows for all using (false);

notify pgrst, 'reload schema';
