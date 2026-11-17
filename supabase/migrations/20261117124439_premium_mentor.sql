-- Private cache: access is mediated by authenticated Edge Function only.
create table yz101.mentor_responses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references yz101.users(id) on delete cascade,
 task_id text not null references yz101.ai_evaluation_tasks(task_id),
 response_hash text not null,
 status text not null check(status in ('pending','ready','failed')),
 explanation text check(char_length(explanation)<=600),
 audio_base64 text check(length(audio_base64)<=2000000),
 voice_status text not null default 'none' check(voice_status in ('none','pending','ready','failed')),
 input_tokens bigint not null default 0, output_tokens bigint not null default 0,
 speech_characters bigint not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 voice_updated_at timestamptz,
 unique(user_id,task_id,response_hash)
);
alter table yz101.mentor_responses enable row level security;
revoke all on yz101.mentor_responses from public,anon,authenticated;
create index mentor_user_recent on yz101.mentor_responses(user_id,updated_at desc);
create or replace function public.yz101_mentor_control(p_action text,p_user uuid,p_task text default null,p_hash text default null,p_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r yz101.mentor_responses; rubric_data jsonb; feedback_data jsonb; new_id uuid;
begin
 if not exists(select 1 from yz101.users where id=p_user and is_premium) then return jsonb_build_object('status','premium_required'); end if;
 perform pg_advisory_xact_lock(hashtextextended('yz101-mentor:'||p_user::text,0));
 if p_action in ('context','reserve') then
  select rubric into rubric_data from yz101.ai_evaluation_tasks where task_id=p_task and enabled;
  if rubric_data is null then return jsonb_build_object('status','unavailable'); end if;
  select feedback into feedback_data from yz101.ai_evaluation_requests where user_id=p_user and task_id=p_task and status='completed' order by finished_at desc limit 1;
  if feedback_data is null then return jsonb_build_object('status','evaluation_required'); end if;
  if p_action='context' then return jsonb_build_object('status','ready','rubric',rubric_data,'feedback',feedback_data); end if;
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_hash'; end if;
  select * into r from yz101.mentor_responses where user_id=p_user and task_id=p_task and response_hash=p_hash;
  if r.status='ready' then return jsonb_build_object('status','cached','id',r.id,'text',r.explanation); end if;
  if exists(select 1 from yz101.mentor_responses where user_id=p_user and status='pending' and updated_at>now()-interval '2 minutes') then return jsonb_build_object('status','processing'); end if;
  if exists(select 1 from yz101.mentor_responses where user_id=p_user and updated_at>now()-interval '10 seconds') then return jsonb_build_object('status','slow_down'); end if;
  insert into yz101.mentor_responses(user_id,task_id,response_hash,status) values(p_user,p_task,p_hash,'pending')
   on conflict(user_id,task_id,response_hash) do update set status='pending',updated_at=now() returning id into new_id;
  return jsonb_build_object('status','reserved','id',new_id);
 end if;
 select * into r from yz101.mentor_responses where id=p_id and user_id=p_user for update;
 if not found then return jsonb_build_object('status','not_found'); end if;
 if p_action='finish' then
  if r.status<>'pending' then return jsonb_build_object('status','ignored'); end if;
  if p_payload->>'ok'='true' and (char_length(p_payload->>'text') not between 11 and 600 or p_payload->>'text' is null) then raise exception 'invalid_text'; end if;
  update yz101.mentor_responses set status=case when p_payload->>'ok'='true' then 'ready' else 'failed' end,
   explanation=case when p_payload->>'ok'='true' then p_payload->>'text' else null end,
   input_tokens=input_tokens+coalesce((p_payload->>'input_tokens')::bigint,0),output_tokens=output_tokens+coalesce((p_payload->>'output_tokens')::bigint,0),updated_at=now() where id=r.id;
  return jsonb_build_object('status','saved');
 elsif p_action='voice_claim' then
  if r.status<>'ready' then return jsonb_build_object('status','not_ready'); end if;
  if r.audio_base64 is not null then return jsonb_build_object('status','cached','audio',r.audio_base64); end if;
  if exists(select 1 from yz101.mentor_responses where user_id=p_user and voice_status='pending' and voice_updated_at>now()-interval '2 minutes') then return jsonb_build_object('status','processing'); end if;
  if exists(select 1 from yz101.mentor_responses where user_id=p_user and voice_updated_at>now()-interval '10 seconds') then return jsonb_build_object('status','slow_down'); end if;
  update yz101.mentor_responses set voice_status='pending',voice_updated_at=now() where id=r.id;
  return jsonb_build_object('status','reserved','text',r.explanation);
 elsif p_action='voice_finish' then
  if r.voice_status<>'pending' then return jsonb_build_object('status','ignored'); end if;
  update yz101.mentor_responses set voice_status=case when p_payload->>'ok'='true' then 'ready' else 'failed' end,
   audio_base64=case when p_payload->>'ok'='true' then p_payload->>'audio' else null end,
   speech_characters=speech_characters+coalesce((p_payload->>'characters')::bigint,0),voice_updated_at=now() where id=r.id;
  return jsonb_build_object('status','saved');
 end if;
 raise exception 'invalid_action';
end;
$$;
revoke all on function public.yz101_mentor_control(text,uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.yz101_mentor_control(text,uuid,text,text,uuid,jsonb) to service_role;
