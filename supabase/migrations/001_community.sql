-- Community feed (Postgres / Supabase): text posts, likes, threaded comments, share count.
-- Idempotent: safe to run multiple times (manual SQL Editor or auto-bootstrap via SUPABASE_DATABASE_URL).

create extension if not exists "pgcrypto";

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  author_name text not null,
  body text not null,
  share_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_posts_body_len check (char_length(body) between 1 and 280)
);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  parent_id uuid references public.community_comments (id) on delete cascade,
  author_id text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_comments_body_len check (char_length(body) between 1 and 500)
);

create index if not exists idx_community_posts_created_at on public.community_posts (created_at desc);
create index if not exists idx_community_comments_post on public.community_comments (post_id);
create index if not exists idx_community_comments_parent on public.community_comments (parent_id);

alter table public.community_posts enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_comments enable row level security;

drop policy if exists "community_posts_read" on public.community_posts;
create policy "community_posts_read" on public.community_posts for select using (true);

drop policy if exists "community_likes_read" on public.community_post_likes;
create policy "community_likes_read" on public.community_post_likes for select using (true);

drop policy if exists "community_comments_read" on public.community_comments;
create policy "community_comments_read" on public.community_comments for select using (true);

drop policy if exists "community_posts_no_insert" on public.community_posts;
create policy "community_posts_no_insert" on public.community_posts for insert with check (false);

drop policy if exists "community_posts_no_update" on public.community_posts;
create policy "community_posts_no_update" on public.community_posts for update using (false);

drop policy if exists "community_posts_no_delete" on public.community_posts;
create policy "community_posts_no_delete" on public.community_posts for delete using (false);

drop policy if exists "community_likes_no_write" on public.community_post_likes;
create policy "community_likes_no_write" on public.community_post_likes for all using (false);

drop policy if exists "community_comments_no_write" on public.community_comments;
create policy "community_comments_no_write" on public.community_comments for all using (false);

notify pgrst, 'reload schema';
