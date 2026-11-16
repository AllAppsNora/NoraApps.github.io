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
  if found then
   insert into yz101.pilot_progress(user_id,task_id,ai_passed) values(p_user,p_task,true) on conflict(user_id,task_id) do update set ai_passed=true,updated_at=now();
   return jsonb_build_object('status','completed','feedback',existing.feedback,'access',a);
  end if;
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
