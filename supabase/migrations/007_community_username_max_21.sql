-- Raise max username length from 12 to 21 (if you already ran 006 with the old 6–12 constraint).

alter table public.community_usernames drop constraint if exists community_username_format;

alter table public.community_usernames
  add constraint community_username_format check (username ~ '^[a-z0-9_]{6,21}$');
