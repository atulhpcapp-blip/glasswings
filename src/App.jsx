-- Run this complete file in the Supabase SQL Editor. Safe to rerun after the earlier version.
-- Views identify unique signed-in members; shares count successful share-sheet or copy actions.
create table if not exists public.short_engagement (
  video_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  liked boolean not null default false,
  views integer not null default 0 check (views >= 0),
  primary key (video_id, user_id)
);
alter table public.short_engagement add column if not exists first_viewed_at timestamptz;
alter table public.short_engagement add column if not exists liked_at timestamptz;
create index if not exists short_engagement_video_idx on public.short_engagement(video_id);
update public.short_engagement set first_viewed_at = now() where views > 0 and first_viewed_at is null;
update public.short_engagement set liked_at = now() where liked and liked_at is null;
alter table public.short_engagement enable row level security;
drop policy if exists "Members can read reel engagement" on public.short_engagement;
drop policy if exists "Members can add their reel engagement" on public.short_engagement;
drop policy if exists "Members can update their reel engagement" on public.short_engagement;
drop policy if exists "Members read own reel engagement" on public.short_engagement;
create policy "Members read own reel engagement" on public.short_engagement
  for select to authenticated using (auth.uid() = user_id);
create policy "Members can add their reel engagement" on public.short_engagement
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Members can update their reel engagement" on public.short_engagement
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.short_engagement to authenticated;

create table if not exists public.short_shares (
  id bigint generated always as identity primary key,
  video_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists short_shares_video_idx on public.short_shares(video_id);
alter table public.short_shares enable row level security;
drop policy if exists "Members add own shares" on public.short_shares;
create policy "Members add own shares" on public.short_shares
  for insert to authenticated with check (auth.uid() = user_id);
grant insert on public.short_shares to authenticated;

create or replace function public.short_engagement_counts(p_video_ids text[])
returns table(video_id text, views bigint, likes bigint, shares bigint, liked_by_me boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select ids.id,
    (select count(*) from public.short_engagement e where e.video_id = ids.id and e.views > 0),
    (select count(*) from public.short_engagement e where e.video_id = ids.id and e.liked),
    (select count(*) from public.short_shares s where s.video_id = ids.id),
    exists(select 1 from public.short_engagement e where e.video_id = ids.id and e.user_id = auth.uid() and e.liked)
  from unnest(p_video_ids) as ids(id)
  where auth.uid() is not null;
$$;
revoke all on function public.short_engagement_counts(text[]) from public;
grant execute on function public.short_engagement_counts(text[]) to authenticated;

-- Individual names are only available to staff roles in profiles.
create or replace function public.short_engagement_analytics(p_video_id text, p_kind text)
returns table(user_id uuid, full_name text, avatar_url text, occurred_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and (
      coalesce(to_jsonb(p)->>'role', '') in ('superadmin','admin','subadmin','organiser','promoter')
      or coalesce(to_jsonb(p)->'roles', '[]'::jsonb) ?| array['superadmin','admin','subadmin','organiser','promoter']
    )
  ) then raise exception 'Staff access required'; end if;
  if p_kind not in ('views','likes','shares') then raise exception 'Invalid analytics category'; end if;
  if p_kind = 'shares' then
    return query select s.user_id, coalesce(p.full_name,'Member')::text, p.avatar_url::text, max(s.created_at), count(*)
      from public.short_shares s left join public.profiles p on p.id = s.user_id
      where s.video_id = p_video_id group by s.user_id, p.full_name, p.avatar_url order by max(s.created_at) desc;
  else
    return query select e.user_id, coalesce(p.full_name,'Member')::text, p.avatar_url::text,
      case when p_kind = 'views' then e.first_viewed_at else e.liked_at end, 1::bigint
      from public.short_engagement e left join public.profiles p on p.id = e.user_id
      where e.video_id = p_video_id and ((p_kind = 'views' and e.views > 0) or (p_kind = 'likes' and e.liked))
      order by 4 desc nulls last;
  end if;
end;
$$;
revoke all on function public.short_engagement_analytics(text,text) from public;
grant execute on function public.short_engagement_analytics(text,text) to authenticated;

-- Reel-to-party booking links. Existing event access rules still apply when opened.
create table if not exists public.reel_event_links (
  video_id text primary key,
  event_id uuid not null
);
alter table public.reel_event_links enable row level security;
drop policy if exists "Members read reel event links" on public.reel_event_links;
create policy "Members read reel event links" on public.reel_event_links for select to authenticated using (true);
drop policy if exists "Staff manage reel event links" on public.reel_event_links;
create policy "Staff manage reel event links" on public.reel_event_links for all to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and (
  coalesce(to_jsonb(p)->>'role','') in ('superadmin','admin','subadmin','organiser','promoter')
  or coalesce(to_jsonb(p)->'roles','[]'::jsonb) ?| array['superadmin','admin','subadmin','organiser','promoter'])))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and (
  coalesce(to_jsonb(p)->>'role','') in ('superadmin','admin','subadmin','organiser','promoter')
  or coalesce(to_jsonb(p)->'roles','[]'::jsonb) ?| array['superadmin','admin','subadmin','organiser','promoter'])));
grant select,insert,update,delete on public.reel_event_links to authenticated;

-- Refresh the Supabase API schema cache and confirm the booking table exists.
notify pgrst, 'reload schema';
select to_regclass('public.reel_event_links') as booking_links_table,
       to_regclass('public.short_engagement') as reel_engagement_table,
       to_regclass('public.short_shares') as reel_shares_table;
