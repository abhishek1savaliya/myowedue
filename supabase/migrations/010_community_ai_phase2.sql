-- Phase 2 AI personalization support (pgvector + online signals).
create extension if not exists vector;

create table if not exists public.community_post_embeddings (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  embedding vector(384) not null,
  model text not null default 'Xenova/all-MiniLM-L6-v2',
  updated_at timestamptz not null default now()
);

create table if not exists public.community_user_interest_vectors (
  user_id text primary key,
  embedding vector(384) not null,
  model text not null default 'Xenova/all-MiniLM-L6-v2',
  updated_at timestamptz not null default now()
);

create table if not exists public.community_feed_signals (
  id bigserial primary key,
  user_id text not null,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'like', 'comment', 'share', 'save', 'open')),
  watch_time_ms integer not null default 0,
  scroll_duration_ms integer not null default 0,
  dwell_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_feed_signals_user_created
  on public.community_feed_signals (user_id, created_at desc);
create index if not exists idx_community_feed_signals_post_created
  on public.community_feed_signals (post_id, created_at desc);

-- Approximate nearest-neighbor index for vector search.
create index if not exists idx_community_post_embeddings_hnsw
  on public.community_post_embeddings using hnsw (embedding vector_cosine_ops);

