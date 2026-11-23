-- Ensure new registrations preserve the selected Student, Staff, or Administrator role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    case new.raw_user_meta_data ->> 'role'
      when 'admin' then 'admin'::public.user_role
      when 'staff' then 'staff'::public.user_role
      else 'patient'::public.user_role
    end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Repair profiles for users who registered before this trigger was deployed.
update public.profiles as profiles
set role = case auth_users.raw_user_meta_data ->> 'role'
  when 'admin' then 'admin'::public.user_role
  when 'staff' then 'staff'::public.user_role
  else 'patient'::public.user_role
end
from auth.users as auth_users
where profiles.id = auth_users.id
  and auth_users.raw_user_meta_data ->> 'role' in ('admin', 'staff', 'student', 'patient');
