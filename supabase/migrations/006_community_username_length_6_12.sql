-- Tighten community username length to 6–12 characters (matches app validation).
-- If this fails, shorten or drop conflicting rows in community_usernames first.

alter table public.community_usernames drop constraint if exists community_username_format;

alter table public.community_usernames
  add constraint community_username_format check (username ~ '^[a-z0-9_]{6,12}$');
