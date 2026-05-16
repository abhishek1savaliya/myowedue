-- Auto-generated SEO fields for community posts (metadata, Open Graph, sitemap).

alter table public.community_posts
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text[] not null default '{}';

create index if not exists idx_community_posts_updated_at on public.community_posts (updated_at desc);

notify pgrst, 'reload schema';
