-- Internal, once-per-news summary jobs. No user/account data is sent to AI.
create table yz101.news_summary_jobs (
 news_id uuid primary key references yz101.news(id) on delete cascade,
 status text not null check(status in ('running','completed','failed')),
 attempts integer not null default 1 check(attempts between 1 and 2),
 lease uuid not null, updated_at timestamptz not null default now(),
 word_count integer, input_tokens integer not null default 0, output_tokens integer not null default 0,
 error text
);
alter table yz101.news_summary_jobs enable row level security;
revoke all on yz101.news_summary_jobs from public,anon,authenticated;
create or replace function public.yz101_news_summary(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n yz101.news; j yz101.news_summary_jobs; txt text; wc integer; token uuid;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(101,819);
 select * into n from yz101.news where publish_date=(now() at time zone 'Europe/Istanbul')::date and source_url is not null limit 1;
 if n.id is null then return jsonb_build_object('run',false,'status','no_news'); end if;
 select * into j from yz101.news_summary_jobs where news_id=n.id;
 if p_action='claim' then
  if j.status='completed' or j.attempts>=2 or (j.status='running' and j.updated_at>now()-interval '10 minutes') or j.updated_at>now()-interval '55 minutes' then
   return jsonb_build_object('run',false,'status',coalesce(j.status,'waiting'));
  end if;
  token:=gen_random_uuid();
  insert into yz101.news_summary_jobs(news_id,status,lease) values(n.id,'running',token)
  on conflict(news_id) do update set status='running',attempts=yz101.news_summary_jobs.attempts+1,lease=excluded.lease,updated_at=now(),error=null;
  return jsonb_build_object('run',true,'id',n.id,'lease',token,'title',n.title,'url',n.source_url,'existing_text',n.full_text);
 elsif p_action in ('finish','fail') then
  if j.status is distinct from 'running' or j.lease is distinct from (p_data->>'lease')::uuid or n.id is distinct from (p_data->>'id')::uuid then raise exception 'Invalid lease'; end if;
  if p_action='finish' then
   txt:=trim(p_data->>'text');wc:=cardinality(regexp_split_to_array(txt,E'\\s+'));
   if txt is null or wc not between 100 and 150 or length(txt)>3000 or txt !~ '[.!?…][”"'']?$' then raise exception 'Invalid summary';end if;
   update yz101.news set full_text=txt where id=n.id;
  end if;
  update yz101.news_summary_jobs set status=case when p_action='finish' then 'completed' else 'failed' end,word_count=wc,
   input_tokens=input_tokens+greatest(0,coalesce((p_data->>'input_tokens')::int,0)),
   output_tokens=output_tokens+greatest(0,coalesce((p_data->>'output_tokens')::int,0)),
   error=case when p_action='fail' then left(p_data->>'error',160) else null end,updated_at=now() where news_id=n.id;
  return jsonb_build_object('status',case when p_action='finish' then 'completed' else 'failed' end,'words',wc);
 end if;
 raise exception 'Unknown action';
end $$;
revoke all on function public.yz101_news_summary(text,jsonb) from public,anon,authenticated;
grant execute on function public.yz101_news_summary(text,jsonb) to service_role;
