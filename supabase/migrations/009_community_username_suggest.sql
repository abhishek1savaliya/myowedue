-- Prefix search for public @username autocomplete (escaped ILIKE).

create or replace function public.community_username_suggest(prefix text, lim int default 10)
returns table(username text)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  p text := lower(trim(both from prefix));
  likepat text;
  n int := least(greatest(coalesce(lim, 10), 1), 25);
begin
  if length(p) < 1 or length(p) > 21 then
    return;
  end if;
  if p !~ '^[a-z0-9_]+$' then
    return;
  end if;

  likepat :=
    replace(replace(replace(p, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  return query
  select u.username::text
  from public.community_usernames u
  where u.username ilike likepat escape '\'
  order by u.username asc
  limit n;
end;
$$;

grant execute on function public.community_username_suggest(text, int) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
