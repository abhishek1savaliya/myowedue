-- Topics extracted from community post bodies (NLP + hashtags). Used for trending.
-- Run after 001_community.sql. Service role inserts via API; public read-only.

create table if not exists public.post_topics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  topic text not null,
  created_at timestamptz not null default now(),
  constraint post_topics_topic_len check (char_length(topic) between 2 and 120),
  constraint post_topics_unique_per_post unique (post_id, topic)
);

create index if not exists idx_post_topics_topic_lower on public.post_topics (lower(topic));
create index if not exists idx_post_topics_post_id on public.post_topics (post_id);

alter table public.post_topics enable row level security;

drop policy if exists "post_topics_read" on public.post_topics;
create policy "post_topics_read" on public.post_topics for select using (true);

drop policy if exists "post_topics_no_write" on public.post_topics;
create policy "post_topics_no_write" on public.post_topics for all using (false);

notify pgrst, 'reload schema';
