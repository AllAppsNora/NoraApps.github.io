-- Use the established profile/news ledger with the new lesson progress.
create function public.yz101_app(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v uuid:=auth.uid(); r jsonb; last_read timestamptz; period text;
begin
 if v is null or not exists(select 1 from auth.users where id=v and deleted_at is null) then raise exception 'Oturum açmanız gerekiyor.' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v::text,101));
 if p_action='state' then
  r:=public.yz101_lesson_state();
  select max(read_at) into last_read from yz101.user_news_points where user_id=v;
  return r||jsonb_build_object(
   'profile',(select to_jsonb(u)-'expo_push_token' from yz101.users u where id=v),
   'points',coalesce((select sum(points) from yz101.scores where user_id=v),0),
   'news_points',coalesce((select sum(points) from yz101.scores where user_id=v and type='news'),0),
   'legacy_completed',(select count(*) from yz101.user_module_progress where user_id=v),
   'news_unlock_at',last_read+interval '24 hours',
   'news',coalesce((select jsonb_agg(t) from (select n.id,n.title,n.summary,n.full_text,n.publish_date,n.source_url,n.source_name,n.source_published_at,exists(select 1 from yz101.user_news_points p where p.user_id=v and p.news_id=n.id) as read from yz101.news n where n.publish_date=(now() at time zone 'Europe/Istanbul')::date and n.source_url is not null order by n.source_published_at desc nulls last,n.id limit 1)t),'[]'::jsonb));
 elsif p_action in ('profile','enroll') then
  -- Existing validated profile implementation; never accept a client level or premium flag.
  return private.yz101_api(p_action,p_data-'exam_id'-'answers');
 elsif p_action='read_news' then
  return private.yz101_daily_api(p_action,p_data);
 elsif p_action='ranking' then
  period:=coalesce(p_data->>'period','all');
  if period not in ('all','week','month') then raise exception 'Geçersiz dönem.'; end if;
  return (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
   select p.username,coalesce(sum(s.points),0) as points,p.id=v as is_me
   from yz101.users p join auth.users a on a.id=p.id and a.deleted_at is null and (a.banned_until is null or a.banned_until<=now())
   left join yz101.scores s on s.user_id=p.id and (period='all' or s.created_at>=case when period='week' then date_trunc('week',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul' else date_trunc('month',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul' end)
   group by p.id,p.username order by points desc,p.username,p.id limit 100)t);

 end if;
 raise exception 'Geçersiz işlem.';
end $$;
revoke all on function public.yz101_app(text,jsonb) from public,anon;
grant execute on function public.yz101_app(text,jsonb) to authenticated;
