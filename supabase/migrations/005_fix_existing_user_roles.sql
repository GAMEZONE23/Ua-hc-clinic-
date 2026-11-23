-- Fix stale role values for existing users created before the signup-role fix.
-- The app stores student as patient in the database, while staff and admin remain as-is.

update public.profiles as p
set role = case
  when au.raw_user_meta_data ->> 'role' = 'admin' then 'admin'
  when au.raw_user_meta_data ->> 'role' = 'staff' then 'staff'
  when au.raw_user_meta_data ->> 'role' in ('student', 'patient') then 'patient'
  else p.role
end
from auth.users as au
where p.id = au.id
  and coalesce(au.raw_user_meta_data ->> 'role', '') in ('student', 'patient', 'staff', 'admin');

-- Optional safety check: ensure any unknown role is normalized to patient.
update public.profiles
set role = 'patient'
where role not in ('patient', 'staff', 'admin');
