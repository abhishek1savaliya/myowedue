-- Per-user shares (which posts this user used “Repost” / share on). Idempotent.

create table if not exists public.community_post_shares (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_community_post_shares_user_created
  on public.community_post_shares (user_id, created_at desc);

alter table public.community_post_shares enable row level security;

drop policy if exists "community_shares_read" on public.community_post_shares;
create policy "community_shares_read" on public.community_post_shares for select using (true);

drop policy if exists "community_shares_no_write" on public.community_post_shares;
create policy "community_shares_no_write" on public.community_post_shares for all using (false);

notify pgrst, 'reload schema';
