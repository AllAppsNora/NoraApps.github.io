begin;
-- All changes below are rolled back; only an existing disabled QA account is used.
select set_config('request.jwt.claim.sub','d542bfb1-a8be-466a-93ff-9f2577e49017',true);
do $$
declare u uuid:='d542bfb1-a8be-466a-93ff-9f2577e49017'; a jsonb; r jsonb; rid uuid; k yz101.pilot_answer_keys; wrong integer[]; reservation uuid;
begin
 update yz101.users set is_premium=false where id=u;
 a:=public.yz101_lesson_state(); assert (a->'access'->>'failures')::int=0,'Fresh counter';
 r:=public.yz101_lesson_test('P02',array[0,0,0],null,gen_random_uuid());assert r->>'status'='prerequisite','Sequence enforced';
 r:=public.yz101_lesson_test('P01',array[0,0,0],null,gen_random_uuid());assert r->>'status'='ai_required','AI required';
 insert into yz101.pilot_progress(user_id,task_id,ai_passed) values(u,'P01',true);
 select * into k from yz101.pilot_answer_keys where task_id='P01';
 wrong:=array[(k.quiz_answers[1]+1)%4,k.quiz_answers[2],k.quiz_answers[3]];
 r:=public.yz101_lesson_test('P01',null,null,gen_random_uuid()); assert r->>'status'='incomplete','Incomplete no attempt';
 rid:=gen_random_uuid();r:=public.yz101_lesson_test('P01',wrong,null,rid);
 assert r->>'passed'='false' and r->>'correct_count'='2','Wrong answer graded';
 assert r->'access'->>'failures'='1' and r->'access'->>'cooldown_until' is null,'First failure retry';
 r:=public.yz101_lesson_test('P01',wrong,null,rid);assert r->'access'->>'failures'='1','Idempotent retry';
 r:=public.yz101_lesson_test('P01',wrong,null,gen_random_uuid());
 assert r->'access'->>'failures'='2','Second failure';
 assert (r->'access'->>'cooldown_until')::timestamptz=now()+interval '24 hours','Rolling 24 hours';
 r:=public.yz101_lesson_test('P01',k.quiz_answers,null,gen_random_uuid());assert r->>'status'='cooldown','Blocked during wait';
 update yz101.lesson_access set cooldown_until=now()-interval '1 second' where user_id=u;
 r:=public.yz101_lesson_state();assert r->'access'->>'failures'='0' and r->'access'->>'cycle'='1','Expiry resets';
 r:=public.yz101_lesson_test('P01',k.quiz_answers,null,gen_random_uuid());assert r->>'passed'='true' and r->'access'->>'reason'='success','Success starts wait';
 r:=public.yz101_lesson_test('P02',array[0,0,0],null,gen_random_uuid());assert r->>'status'='cooldown','One success per24h';
 -- Premium bypasses learning cooldown. Preserve original value on rollback.
 insert into yz101.users(id,is_premium) values(u,true) on conflict(id) do update set is_premium=true;
 r:=public.yz101_lesson_state();assert r->'access'->>'premium'='true' and r->'access'->>'cooldown_until' is null,'Premium bypass';
 insert into yz101.pilot_progress(user_id,task_id,ai_passed) values(u,'P02',true);
 select * into k from yz101.pilot_answer_keys where task_id='P02';
 r:=public.yz101_lesson_test('P02',k.quiz_answers,null,gen_random_uuid());assert r->>'passed'='true','Premium next lesson';
 -- Technical failure and duplicate finalization do not consume attempts.
 update yz101.users set is_premium=false where id=u;
 update yz101.lesson_access set failures=0,cooldown_until=null,reason=null where user_id=u;
 insert into yz101.ai_evaluation_requests(user_id,task_id,response_hash,status,reserved_usd) values(u,'P03',repeat('a',64),'reserved',.005) returning id into reservation;
 r:=public.yz101_ai_evaluation_control('finish',p_id=>reservation,p_payload=>'{"ok":false}');
 assert r->'access'->>'failures'='0','Technical no attempt';
 insert into yz101.ai_evaluation_requests(user_id,task_id,response_hash,status,reserved_usd) values(u,'P03',repeat('b',64),'reserved',.005) returning id into reservation;
 r:=public.yz101_ai_evaluation_control('finish',p_id=>reservation,p_payload=>'{"ok":true,"feedback":{"passed":false,"feedback":"Eksik gerekçe."}}');
 assert r->'access'->>'failures'='1','AI failure shared';
 r:=public.yz101_ai_evaluation_control('finish',p_id=>reservation,p_payload=>'{"ok":true,"feedback":{"passed":false,"feedback":"Eksik gerekçe."}}');assert r->'access'->>'failures'='1','Finish idempotent';
 insert into yz101.pilot_progress(user_id,task_id,ai_passed) values(u,'P03',true);
 select * into k from yz101.pilot_answer_keys where task_id='P03';wrong:=array[(k.quiz_answers[1]+1)%4,k.quiz_answers[2],k.quiz_answers[3]];
 r:=public.yz101_lesson_test('P03',wrong,null,gen_random_uuid());assert r->'access'->>'reason'='retry','AI and quiz share attempts';
 -- All 45 question keys and 4 numeric checks through the server, premium fixture.
 update yz101.users set is_premium=true where id=u;
 for k in select * from yz101.pilot_answer_keys order by task_id loop
  insert into yz101.pilot_progress(user_id,task_id,ai_passed) values(u,k.task_id,true) on conflict(user_id,task_id) do update set ai_passed=true;
  if k.numeric_value is not null then
   r:=public.yz101_lesson_test(k.task_id,k.quiz_answers,k.numeric_value+100,gen_random_uuid());assert r->>'passed'='false' and r->>'numeric_passed'='false','Numeric wrong rejected';
  end if;
  r:=public.yz101_lesson_test(k.task_id,k.quiz_answers,k.numeric_value,gen_random_uuid());assert r->>'passed'='true' or r->>'status'='already_completed','All keys pass';
 end loop;
 assert (select count(*) from yz101.pilot_progress where user_id=u and completed)=15,'All lessons complete';
 assert not has_table_privilege('authenticated','yz101.lesson_access','UPDATE'),'Counter protected';
 assert not has_table_privilege('authenticated','yz101.users','UPDATE'),'Premium protected';
 assert not has_function_privilege('anon','public.yz101_lesson_test(text,integer[],numeric,uuid)','EXECUTE'),'Auth required';
 assert not has_function_privilege('authenticated','public.yz101_ai_evaluation_control(text,uuid,text,text,uuid,jsonb)','EXECUTE'),'Grader service only';
end $$;
rollback;
select 'PASS: sequence, AI prerequisite, shared attempts, 24h expiry, idempotency, premium, 45 answers, 4 numeric exercises, privileges' as result;
