-- Per-comment likes for threaded community replies (Supabase / Postgres).
-- Run after 001_community.sql (depends on community_comments).

create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_comments (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists idx_community_comment_likes_comment on public.community_comment_likes (comment_id);

alter table public.community_comment_likes enable row level security;

drop policy if exists "community_comment_likes_read" on public.community_comment_likes;
create policy "community_comment_likes_read" on public.community_comment_likes for select using (true);
