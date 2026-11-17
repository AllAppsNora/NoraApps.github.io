-- Preserve the existing score ledger; mark new lesson awards explicitly.
alter table yz101.scores add column pilot_task_id text;
alter table yz101.scores add constraint scores_pilot_progress_fkey foreign key(user_id,pilot_task_id) references yz101.pilot_progress(user_id,task_id) on delete cascade;
alter table yz101.scores add constraint scores_pilot_reward_check check(pilot_task_id is null or (user_id is not null and points is not null and points=100 and type is not null and type='pilot_lesson'));
create unique index scores_pilot_lesson_once on yz101.scores(user_id,pilot_task_id) where pilot_task_id is not null;
alter table yz101.scores enable row level security;
-- Only the server can create awards. Existing table access remains unchanged.
create function yz101.award_pilot_lesson_points() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.completed and new.ai_passed and new.quiz_passed and new.numeric_passed then
  insert into yz101.scores(user_id,points,type,pilot_task_id) values(new.user_id,100,'pilot_lesson',new.task_id)
  on conflict(user_id,pilot_task_id) where pilot_task_id is not null do nothing;
 end if;
 return new;
end $$;
revoke all on function yz101.award_pilot_lesson_points() from public,anon,authenticated;
create trigger award_pilot_lesson_points after insert or update on yz101.pilot_progress for each row execute function yz101.award_pilot_lesson_points();
-- Include prior completions without changing lesson progress, accounts, or cooldowns.
insert into yz101.scores(user_id,points,type,pilot_task_id,created_at)
select user_id,100,'pilot_lesson',task_id,updated_at from yz101.pilot_progress where completed and ai_passed and quiz_passed and numeric_passed
on conflict(user_id,pilot_task_id) where pilot_task_id is not null do nothing;
create or replace function public.yz101_lesson_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 a:=yz101.lesson_access_state(u);
 return jsonb_build_object('access',a,'lesson_points',coalesce((select sum(points) from yz101.scores where user_id=u and pilot_task_id is not null),0),'progress',coalesce((select jsonb_agg(jsonb_build_object('task_id',task_id,'quiz_passed',quiz_passed,'ai_passed',ai_passed,'numeric_passed',numeric_passed,'completed',completed)) from yz101.pilot_progress where user_id=u),'[]'::jsonb));
end $$;
revoke all on function public.yz101_lesson_state() from public,anon;
grant execute on function public.yz101_lesson_state() to authenticated;
