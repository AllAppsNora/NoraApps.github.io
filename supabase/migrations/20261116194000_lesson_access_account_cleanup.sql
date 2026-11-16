alter table yz101.lesson_access drop constraint lesson_access_user_id_fkey, add constraint lesson_access_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table yz101.lesson_submissions drop constraint lesson_submissions_user_id_fkey, add constraint lesson_submissions_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
