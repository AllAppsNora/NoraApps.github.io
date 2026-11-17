-- DDL only: no profile or account is deleted by this migration.
-- When a user later confirms profile deletion through the existing app action,
-- remove that profile's new lesson records as well as the legacy records.
create function yz101.cleanup_profile_lessons() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from yz101.lesson_submissions where user_id=old.id;
 delete from yz101.lesson_access where user_id=old.id;
 delete from yz101.ai_evaluation_requests where user_id=old.id;
 delete from yz101.pilot_progress where user_id=old.id;
 return old;
end $$;
revoke all on function yz101.cleanup_profile_lessons() from public,anon,authenticated;
create trigger cleanup_profile_lessons after delete on yz101.users for each row execute function yz101.cleanup_profile_lessons();
