-- =====================================================================
-- Glasswings — Meet only shows people with a photo
-- Ticket-buyers without a profile photo are quietly kept OUT of Meet
-- (no flag, no shame) until they add one. Admins still see everyone so
-- they can review. Flagged profiles: hidden from members, shown to admins.
-- Idempotent. Run BEFORE App.jsx.
-- =====================================================================

drop function if exists public.meet_list();
create function public.meet_list()
returns table (
  id uuid, name text, avatar_url text, gender text, age int, city text, area text,
  last_seen timestamptz, joined timestamptz, waved_by_me boolean, waved_me boolean,
  spotlighted boolean, review_flag text
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.full_name,'Member'),
         p.avatar_url, p.gender, md.age, md.city, md.area,
         p.last_seen, p.created_at,
         exists (select 1 from waves w where w.from_user = auth.uid() and w.to_user = p.id),
         exists (select 1 from waves w where w.from_user = p.id and w.to_user = auth.uid()),
         exists (select 1 from spotlights s where s.user_id = p.id and s.expires_at > now()),
         p.review_flag
  from public.profiles p
  left join public.member_details md on md.user_id = p.id
  where p.id <> auth.uid()
    and coalesce(p.meet_visible, true)
    and coalesce(p.profile_completed, false)
    and coalesce(p.blocked, false) = false
    -- must have a photo (admins still see photo-less + flagged ones)
    and ((coalesce(p.avatar_url,'') <> '' and p.review_flag is null) or public._gw_is_admin_only())
  order by
    (exists (select 1 from spotlights s where s.user_id = p.id and s.expires_at > now())) desc,
    p.last_seen desc nulls last
  limit 300;
$$;
grant execute on function public.meet_list() to authenticated;

-- does the current member have a profile photo? (drives the join-community nudge)
create or replace function public.i_have_photo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select avatar_url from public.profiles where id = auth.uid()), '') <> '';
$$;
grant execute on function public.i_have_photo() to authenticated;

notify pgrst, 'reload schema';
