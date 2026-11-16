create table if not exists yz101.lesson_access (
 user_id uuid primary key references auth.users(id), failures integer not null default 0 check(failures between 0 and 2),
 cooldown_until timestamptz, reason text check(reason in ('success','retry')), cycle integer not null default 0
);
alter table yz101.lesson_access enable row level security;
revoke all on yz101.lesson_access from public,anon,authenticated;
create table if not exists yz101.lesson_submissions (
 user_id uuid not null references auth.users(id), request_id uuid not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(user_id,request_id)
);
alter table yz101.lesson_submissions enable row level security;
revoke all on yz101.lesson_submissions from public,anon,authenticated;
create or replace function yz101.lesson_access_state(u uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r yz101.lesson_access; premium boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,101));
 insert into yz101.lesson_access(user_id) values(u) on conflict do nothing;
 update yz101.lesson_access set failures=0,cooldown_until=null,reason=null,cycle=cycle+1 where user_id=u and cooldown_until<=now();
 select * into r from yz101.lesson_access where user_id=u;
 select coalesce(is_premium,false) into premium from yz101.users where id=u;
 return jsonb_build_object('premium',coalesce(premium,false),'failures',r.failures,'attempts_remaining',case when coalesce(premium,false) then null else greatest(0,2-r.failures) end,'cooldown_until',case when coalesce(premium,false) then null else r.cooldown_until end,'reason',case when coalesce(premium,false) then null else r.reason end,'cycle',r.cycle,'server_now',now());
end $$;
revoke all on function yz101.lesson_access_state(uuid) from public,anon,authenticated;
grant execute on function yz101.lesson_access_state(uuid) to service_role;
create or replace function public.yz101_lesson_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 a:=yz101.lesson_access_state(u);
 return jsonb_build_object('access',a,'progress',coalesce((select jsonb_agg(jsonb_build_object('task_id',task_id,'quiz_passed',quiz_passed,'ai_passed',ai_passed,'numeric_passed',numeric_passed,'completed',completed)) from yz101.pilot_progress where user_id=u),'[]'::jsonb));
end $$;
revoke all on function public.yz101_lesson_state() from public,anon;
grant execute on function public.yz101_lesson_state() to authenticated;
create or replace function public.yz101_lesson_test(p_task text,p_answers integer[],p_numeric numeric default null,p_request uuid default gen_random_uuid()) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a jsonb; k yz101.pilot_answer_keys; old jsonb; flags jsonb; correct integer; numeric_ok boolean; passed boolean; output jsonb; failures integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_request is null then raise exception 'Request ID required'; end if;
 a:=yz101.lesson_access_state(u);
 select result into old from yz101.lesson_submissions where user_id=u and request_id=p_request;
 if found then return old||jsonb_build_object('access',a); end if;
 if exists(select 1 from yz101.pilot_progress where user_id=u and task_id=p_task and completed) then return jsonb_build_object('status','already_completed','access',a); end if;
 if a->>'cooldown_until' is not null then return jsonb_build_object('status','cooldown','access',a); end if;
 select * into k from yz101.pilot_answer_keys where task_id=p_task;
 if not found then raise exception 'Unknown task'; end if;
 if exists(select 1 from yz101.pilot_answer_keys z where z.task_id<p_task and not exists(select 1 from yz101.pilot_progress p where p.user_id=u and p.task_id=z.task_id and p.completed)) then return jsonb_build_object('status','prerequisite','access',a); end if;
 if not exists(select 1 from yz101.pilot_progress where user_id=u and task_id=p_task and ai_passed) and not exists(select 1 from yz101.ai_evaluation_requests where user_id=u and task_id=p_task and status='completed' and feedback->>'passed'='true') then return jsonb_build_object('status','ai_required','access',a); end if;
 if array_length(p_answers,1) is distinct from 3 or exists(select 1 from unnest(p_answers) x where x is null or x<0 or x>3) or (k.numeric_value is not null and p_numeric is null) then return jsonb_build_object('status','incomplete','access',a); end if;
 select jsonb_agg(p_answers[i]=k.quiz_answers[i] order by i),count(*) filter(where p_answers[i]=k.quiz_answers[i]) into flags,correct from generate_series(1,3) i;
 numeric_ok:=k.numeric_value is null or abs(p_numeric-k.numeric_value)<=k.numeric_tolerance;
 passed:=correct=3 and numeric_ok;
 insert into yz101.pilot_progress(user_id,task_id,quiz_passed,ai_passed,numeric_passed,completed) values(u,p_task,correct=3,true,numeric_ok,passed)
 on conflict(user_id,task_id) do update set quiz_passed=excluded.quiz_passed,ai_passed=true,numeric_passed=excluded.numeric_passed,completed=excluded.completed,updated_at=now();
 if not (a->>'premium')::boolean then
  if passed then update yz101.lesson_access set cooldown_until=now()+interval '24 hours',reason='success' where user_id=u;
  else update yz101.lesson_access set failures=least(2,lesson_access.failures+1) where user_id=u returning lesson_access.failures into failures;
   if failures>=2 then update yz101.lesson_access set cooldown_until=now()+interval '24 hours',reason='retry' where user_id=u; end if;
  end if;
 end if;
 a:=yz101.lesson_access_state(u);
 output:=jsonb_build_object('status','evaluated','passed',passed,'answers',flags,'correct_count',correct,'numeric_passed',numeric_ok,'access',a);
 insert into yz101.lesson_submissions(user_id,request_id,result) values(u,p_request,output);
 return output;
end $$;
revoke all on function public.yz101_lesson_test(text,integer[],numeric,uuid) from public,anon;
grant execute on function public.yz101_lesson_test(text,integer[],numeric,uuid) to authenticated;
-- Retire the old mutation endpoint so an already-open pilot cannot bypass the shared cooldown.
create or replace function public.yz101_pilot_submit(p_task text,p_answers integer[] default null,p_numeric numeric default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'Authentication required'; end if; raise exception 'Uygulama güncellendi. Sayfayı yenileyerek devam et.'; end $$;
create or replace function public.yz101_ai_evaluation_control(p_action text,p_user uuid default null,p_task text default null,p_hash text default null,p_id uuid default null,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing yz101.ai_evaluation_requests; a jsonb; used numeric; id_new uuid; t yz101.ai_evaluation_tasks; reserve_amount numeric:=0.005; changed boolean; f integer; cached_hash text;
begin
 if p_action='reserve' then
  if p_user is null or p_task is null or p_hash is null or length(p_hash)<>64 then raise exception 'Invalid arguments'; end if;
  a:=yz101.lesson_access_state(p_user);
  select * into t from yz101.ai_evaluation_tasks where task_id=p_task and enabled;
  if not found then return jsonb_build_object('status','disabled'); end if;
  if exists(select 1 from yz101.pilot_answer_keys z where z.task_id<p_task and not exists(select 1 from yz101.pilot_progress p where p.user_id=p_user and p.task_id=z.task_id and p.completed)) then return jsonb_build_object('status','prerequisite','access',a); end if;
  -- Preserve earlier successful evaluation without another paid call.
  select * into existing from yz101.ai_evaluation_requests where user_id=p_user and task_id=p_task and status='completed' and feedback->>'passed'='true' order by finished_at desc limit 1;
  if found then return jsonb_build_object('status','completed','feedback',existing.feedback,'access',a); end if;
  if a->>'cooldown_until' is not null then return jsonb_build_object('status','cooldown','access',a); end if;
  update yz101.ai_evaluation_requests set status='failed',finished_at=now() where user_id=p_user and status='reserved' and created_at<now()-interval '2 minutes';
  cached_hash:=encode(extensions.digest(p_hash||':'||(a->>'cycle'),'sha256'),'hex');
  select * into existing from yz101.ai_evaluation_requests where user_id=p_user and task_id=p_task and response_hash=cached_hash;
  if found and existing.status<>'failed' then return jsonb_build_object('status',case when existing.status='reserved' then 'processing' else existing.status end,'feedback',existing.feedback,'access',a); end if;
  if exists(select 1 from yz101.ai_evaluation_requests where user_id=p_user and status='reserved') then return jsonb_build_object('status','processing','access',a); end if;
  perform pg_advisory_xact_lock(101,7001);
  select coalesce(sum(case when status='reserved' then reserved_usd else greatest(cost_usd,reserved_usd) end),0) into used from yz101.ai_evaluation_requests where created_at>=date_trunc('day',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
  if used+reserve_amount>0.10 then return jsonb_build_object('status','budget_limit','access',a); end if;
  -- Technical failures may retry; educational failures are cached within their cycle.
  if existing.id is not null and existing.status='failed' then cached_hash:=encode(extensions.digest(cached_hash||gen_random_uuid()::text,'sha256'),'hex'); end if;
  insert into yz101.ai_evaluation_requests(user_id,task_id,response_hash,status,reserved_usd) values(p_user,p_task,cached_hash,'reserved',reserve_amount) returning id into id_new;
  return jsonb_build_object('status','reserved','id',id_new,'rubric',t.rubric,'access',a);
 elsif p_action='finish' then
  select * into existing from yz101.ai_evaluation_requests where id=p_id;
  if not found then raise exception 'Unknown request'; end if;
  a:=yz101.lesson_access_state(existing.user_id);
  update yz101.ai_evaluation_requests set status=case when p_payload->>'ok'='true' then 'completed' else 'failed' end,
   cost_usd=least(greatest(coalesce((p_payload->>'cost_usd')::numeric,0),0),1),input_tokens=least(greatest(coalesce((p_payload->>'input_tokens')::int,0),0),100000),output_tokens=least(greatest(coalesce((p_payload->>'output_tokens')::int,0),0),100000),
   feedback=case when p_payload->>'ok'='true' then p_payload->'feedback' else null end,finished_at=now() where id=p_id and status='reserved';
  changed:=found;
  if changed and p_payload->>'ok'='true' then
   if p_payload->'feedback'->>'passed'='true' then
    insert into yz101.pilot_progress(user_id,task_id,quiz_passed,ai_passed,numeric_passed,completed) values(existing.user_id,existing.task_id,false,true,false,false)
    on conflict(user_id,task_id) do update set ai_passed=true,updated_at=now();
   elsif not (a->>'premium')::boolean then
    update yz101.lesson_access set failures=least(2,failures+1) where user_id=existing.user_id returning failures into f;
    if f>=2 then update yz101.lesson_access set cooldown_until=now()+interval '24 hours',reason='retry' where user_id=existing.user_id; end if;
   end if;
  end if;
  return jsonb_build_object('updated',changed,'access',yz101.lesson_access_state(existing.user_id));
 end if;
 raise exception 'Invalid action';
end $$;
revoke all on function public.yz101_ai_evaluation_control(text,uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.yz101_ai_evaluation_control(text,uuid,text,text,uuid,jsonb) to service_role;
